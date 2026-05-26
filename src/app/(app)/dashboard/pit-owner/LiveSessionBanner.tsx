"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

export interface SessionOrder {
  id:         string;
  pitId:      string;
  loads:      number;
  pitName:    string;
  buyerName:  string;
  haulerName: string;
}

interface Props {
  orders: SessionOrder[];
  pitIds: string[];
}

interface OnSiteEntry {
  orderId:        string;
  distanceMeters: number;
  manual:         boolean;
}

interface SessionState {
  active:            boolean;
  pitOwnerCount:     number;
  sessionCompleted:  boolean;
}

export default function LiveSessionBanner({ orders, pitIds }: Props) {
  const router = useRouter();
  const [onSiteMap,  setOnSiteMap]  = useState<Record<string, boolean>>({});
  const [manualMap,  setManualMap]  = useState<Record<string, boolean>>({});
  const [sessionMap, setSessionMap] = useState<Record<string, SessionState>>({});
  const [loggingId,  setLoggingId]  = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const pollOnSite = useCallback(async () => {
    if (pitIds.length === 0) return;
    const results = await Promise.allSettled(
      pitIds.map((pitId) =>
        fetch(`/api/pits/${pitId}/on-site-drivers`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    );
    const merged: Record<string, boolean> = {};
    const manualMerged: Record<string, boolean> = {};
    for (const result of results) {
      if (result.status === "fulfilled" && result.value?.onSite) {
        for (const entry of result.value.onSite as OnSiteEntry[]) {
          merged[entry.orderId] = true;
          if (entry.manual) manualMerged[entry.orderId] = true;
        }
      }
    }
    setOnSiteMap(merged);
    setManualMap(manualMerged);
  }, [pitIds]);

  const pollSessions = useCallback(async () => {
    if (orders.length === 0) return;
    const results = await Promise.allSettled(
      orders.map((o) =>
        fetch(`/api/haul-orders/${o.id}/pit-session`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    );
    const next: Record<string, SessionState> = {};
    results.forEach((result, i) => {
      if (result.status === "fulfilled" && result.value) {
        next[orders[i].id] = {
          active:           result.value.active ?? false,
          pitOwnerCount:    result.value.pitOwnerCount ?? 0,
          sessionCompleted: result.value.sessionCompleted ?? false,
        };
      }
    });
    setSessionMap(next);
  }, [orders]);

  useEffect(() => {
    pollOnSite();
    const iv = setInterval(pollOnSite, 30_000);
    return () => clearInterval(iv);
  }, [pollOnSite]);

  useEffect(() => {
    pollSessions();
    const iv = setInterval(pollSessions, 15_000);
    return () => clearInterval(iv);
  }, [pollSessions]);

  async function toggleSession(orderId: string, currentlyActive: boolean) {
    setTogglingId(orderId);
    try {
      const res = await fetch(`/api/haul-orders/${orderId}/pit-session`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ active: !currentlyActive }),
      });
      if (res.ok) {
        setSessionMap((prev) => ({
          ...prev,
          [orderId]: { ...(prev[orderId] ?? { pitOwnerCount: 0 }), active: !currentlyActive },
        }));
        // After starting a session, navigate to the focused Log Load screen
        // so the pit owner can immediately begin tapping loads for that order.
        if (!currentlyActive) {
          router.push(`/dashboard/pit-owner/log-load/${orderId}`);
          return;
        }
      }
    } catch {}
    setTogglingId(null);
  }

  async function logLoad(orderId: string) {
    setLoggingId(orderId);
    try {
      const res = await fetch(`/api/haul-orders/${orderId}/pit-log`, { method: "POST" });
      if (res.ok) {
        const { count } = await res.json() as { count: number };
        setSessionMap((prev) => ({
          ...prev,
          [orderId]: { ...(prev[orderId] ?? { active: true }), pitOwnerCount: count },
        }));
      }
    } catch {}
    setLoggingId(null);
  }

  // Show orders that have a driver on-site (and no completed session yet) OR an active session.
  // Once a session has been ended for the day, hide the order so the pit owner can't
  // accidentally start a second session which would reset the load count.
  const visible = orders.filter((o) => {
    const sess = sessionMap[o.id];
    if (sess?.active) return true;
    if (sess?.sessionCompleted) return false; // session done — hide from banner
    return onSiteMap[o.id] === true;
  });

  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 w-full">
      {visible.map((order) => {
        const sessActive = sessionMap[order.id]?.active ?? false;
        const count      = sessionMap[order.id]?.pitOwnerCount ?? 0;

        return (
          <div
            key={order.id}
            className={`rounded-2xl border-2 px-5 py-4 flex flex-wrap items-center justify-between gap-3 shadow-sm ${
              sessActive
                ? "bg-green-50 border-green-400"
                : "bg-amber-50 border-amber-400"
            }`}
          >
            {/* Left: status info */}
            <div className="flex items-center gap-3 min-w-0">
              <span className={`text-2xl shrink-0 ${sessActive ? "" : "animate-bounce"}`}>
                🚛
              </span>
              <div className="min-w-0">
                {sessActive ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                      <p className="font-bold text-green-800">
                        Load Session Active — {order.pitName}
                      </p>
                    </div>
                    <p className="text-sm text-green-700 mt-0.5">
                      {order.buyerName} · {order.haulerName} · {count} load{count !== 1 ? "s" : ""} logged
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                      <p className="font-bold text-amber-800">
                        {order.haulerName} is on site — {order.pitName}
                      </p>
                      {manualMap[order.id] && (
                        <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-semibold">
                          Manual Check-In
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-amber-700 mt-0.5">
                      {order.buyerName} · {order.loads} est. load{order.loads !== 1 ? "s" : ""} — start the session to begin tracking
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Right: action buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {sessActive && (
                <button
                  onClick={() => logLoad(order.id)}
                  disabled={loggingId === order.id}
                  className="bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-green-700 active:scale-95 disabled:opacity-50 transition-all"
                  style={{ touchAction: "manipulation" }}
                >
                  {loggingId === order.id ? "Logging…" : `Log Load (${count})`}
                </button>
              )}
              <button
                onClick={() => toggleSession(order.id, sessActive)}
                disabled={togglingId === order.id}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 ${
                  sessActive
                    ? "bg-white border border-gray-300 text-gray-600 hover:bg-red-50 hover:text-red-600"
                    : "bg-amber-600 text-white hover:bg-amber-700 active:scale-95"
                }`}
                style={{ touchAction: "manipulation" }}
              >
                {togglingId === order.id
                  ? "…"
                  : sessActive
                  ? "End Session"
                  : "Start Loading"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
