"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ActiveHaulOrder {
  id:               string;
  driverId:         string | null;
  loads:            number;
  status:           string;
  buyerName:        string;
  haulerName:       string;
  pitName:          string;
  pitId:            string;
  scheduledDateStr: string;
  pitOwnerApproved: boolean | null;
}

interface Props {
  orders: ActiveHaulOrder[];
  pitIds: string[];
}

interface SessionState {
  active:        boolean;
  pitOwnerCount: number;
}

const statusColors: Record<string, string> = {
  PENDING:   "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-green-100 text-green-700",
  ACTIVE:    "bg-blue-100 text-blue-700",
  COMPLETED: "bg-gray-100 text-gray-500",
  CANCELLED: "bg-gray-100 text-gray-400",
  DENIED:    "bg-red-100 text-red-700",
};

export default function OnSitePanel({ orders, pitIds }: Props) {
  const router = useRouter();
  const [onSiteMap,    setOnSiteMap]    = useState<Record<string, boolean>>({});
  const [manualMap,    setManualMap]    = useState<Record<string, boolean>>({});
  const [sessionMap,   setSessionMap]   = useState<Record<string, SessionState>>({});
  const [loggingId,    setLoggingId]    = useState<string | null>(null);
  const [togglingId,   setTogglingId]   = useState<string | null>(null);

  // Poll on-site drivers every 30 s
  useEffect(() => {
    if (pitIds.length === 0) return;

    async function pollOnSite() {
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
          for (const entry of result.value.onSite as Array<{ orderId: string; manual: boolean }>) {
            merged[entry.orderId] = true;
            if (entry.manual) manualMerged[entry.orderId] = true;
          }
        }
      }
      setOnSiteMap(merged);
      setManualMap(manualMerged);
    }

    pollOnSite();
    const iv = setInterval(pollOnSite, 30_000);
    return () => clearInterval(iv);
  }, [pitIds]);

  // Poll session status + pit owner count for each order every 15 s
  useEffect(() => {
    if (orders.length === 0) return;

    async function pollSessions() {
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
            active:        result.value.active ?? false,
            pitOwnerCount: result.value.pitOwnerCount ?? 0,
          };
        }
      });
      setSessionMap(next);
    }

    pollSessions();
    const iv = setInterval(pollSessions, 15_000);
    return () => clearInterval(iv);
  }, [orders]);

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
        // Navigate to operator console after starting a session
        if (!currentlyActive) {
          router.push("/operator");
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
        const { count } = await res.json();
        setSessionMap((prev) => ({
          ...prev,
          [orderId]: { ...(prev[orderId] ?? { active: true }), pitOwnerCount: count },
        }));
      }
    } catch {}
    setLoggingId(null);
  }

  if (orders.length === 0) {
    return (
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Accepted Haul Orders (0)
        </h2>
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400">
          <p className="text-sm">No accepted haul orders yet</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Accepted Haul Orders ({orders.length})
      </h2>
      <div className="space-y-3">
        {orders.map((order) => {
          const isOnSite  = onSiteMap[order.id] === true;
          const isManual  = manualMap[order.id]  === true;
          const session   = sessionMap[order.id];
          const sessActive = session?.active ?? false;
          const pitCount   = session?.pitOwnerCount ?? 0;

          return (
            <div key={order.id}
              className={`bg-white rounded-2xl border p-5 transition-all ${
                isOnSite
                  ? "ring-2 ring-amber-400 ring-offset-2 border-amber-300 shadow-md"
                  : "border-indigo-200"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-900">{order.buyerName}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusColors[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {order.status}
                    </span>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                      Accepted ✓
                    </span>
                    {isOnSite && (
                      <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold animate-pulse">
                        🚛 On Site{isManual ? " — Manual Check-In" : " — arrived"}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-gray-500 mt-0.5">{order.pitName}</p>
                  <p className="text-xs text-gray-400">Hauler: {order.haulerName}</p>
                  <p className="text-xs text-gray-400 mt-1">{order.scheduledDateStr}</p>
                </div>

                <div className="text-right shrink-0 space-y-1">
                  <div>
                    <p className="text-lg font-bold text-gray-900">{pitCount}</p>
                    <p className="text-xs text-gray-400">logged</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">/ {order.loads} est.</p>
                  </div>
                </div>
              </div>

              {/* Load session controls — shown when driver is on site or session is already active */}
              {(isOnSite || sessActive) && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                  {/* Session toggle */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${sessActive ? "bg-amber-500 animate-pulse" : "bg-gray-300"}`} />
                      <p className="text-xs font-semibold text-gray-700">
                        {sessActive ? "Load session active — driver tap unlocked" : "Start session to unlock driver tap"}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleSession(order.id, sessActive)}
                      disabled={togglingId === order.id}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                        sessActive
                          ? "bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600"
                          : "bg-amber-600 text-white hover:bg-amber-700"
                      } disabled:opacity-50`}
                    >
                      {togglingId === order.id ? "…" : sessActive ? "End Session" : "Start Loading"}
                    </button>
                  </div>

                  {/* Log load button — only enabled when session is active */}
                  {sessActive && (
                    <button
                      onClick={() => logLoad(order.id)}
                      disabled={loggingId === order.id}
                      className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {loggingId === order.id ? "Logging…" : `Log Load (${pitCount} so far)`}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
