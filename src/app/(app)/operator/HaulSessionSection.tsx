"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface HaulSession {
  orderId:          string;
  pitName:          string;
  buyerName:        string;
  haulerName:       string;
  estimatedLoads:   number;
  sessionActive:    boolean;
  sessionCompleted: boolean;
  pitOwnerCount:    number;
  driverCount:      number;
  sessionStartedAt: string | null;
  onSite:           boolean;
  manual:           boolean;
}

const POLL_MS    = 10_000;
const CONFIRM_MS = 4_000;

// Per-order state for the tap confirmation flow
interface TapState { pending: boolean; logging: boolean; lastLogged: string | null; }

// Per-order state for end-session summary
interface SummaryState {
  finalCount:    number;
  driverCount:   number;
  cobDueAt:      string | null;
  afterHoursFee: number;
}

export default function HaulSessionSection() {
  const [sessions,    setSessions]    = useState<HaulSession[]>([]);
  const [tapState,    setTapState]    = useState<Record<string, TapState>>({});
  const [toggling,    setToggling]    = useState<string | null>(null);
  const [summaries,   setSummaries]   = useState<Record<string, SummaryState>>({});
  const [startErrors, setStartErrors] = useState<Record<string, string>>({});

  const confirmTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const endingRef     = useRef<Record<string, boolean>>({});

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/operator/haul-sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions ?? []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    poll();
    const iv = setInterval(poll, POLL_MS);
    return () => clearInterval(iv);
  }, [poll]);

  async function startSession(orderId: string) {
    setToggling(orderId);
    setStartErrors((prev) => { const n = { ...prev }; delete n[orderId]; return n; });
    try {
      const res  = await fetch(`/api/haul-orders/${orderId}/pit-session`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ active: true }),
      });
      if (res.ok) {
        await poll();
      } else {
        const data = await res.json() as { error?: string };
        setStartErrors((prev) => ({
          ...prev,
          [orderId]: data.error ?? "Could not start session",
        }));
      }
    } catch {
      setStartErrors((prev) => ({ ...prev, [orderId]: "Network error — please try again" }));
    }
    setToggling(null);
  }

  function getTap(orderId: string): TapState {
    return tapState[orderId] ?? { pending: false, logging: false, lastLogged: null };
  }
  function setTap(orderId: string, update: Partial<TapState>) {
    setTapState((prev) => ({
      ...prev,
      [orderId]: { ...(prev[orderId] ?? { pending: false, logging: false, lastLogged: null }), ...update },
    }));
  }

  async function handleTap(orderId: string) {
    const tap = getTap(orderId);
    if (tap.logging) return;

    if (!tap.pending) {
      setTap(orderId, { pending: true });
      if (confirmTimers.current[orderId]) clearTimeout(confirmTimers.current[orderId]);
      confirmTimers.current[orderId] = setTimeout(() => setTap(orderId, { pending: false }), CONFIRM_MS);
      return;
    }

    if (confirmTimers.current[orderId]) clearTimeout(confirmTimers.current[orderId]);
    setTap(orderId, { pending: false, logging: true });

    try {
      const res = await fetch(`/api/haul-orders/${orderId}/pit-log`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        const time = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
        setTap(orderId, { logging: false, lastLogged: time });
        setSessions((prev) =>
          prev.map((s) =>
            s.orderId === orderId ? { ...s, pitOwnerCount: data.count } : s
          )
        );
      } else {
        setTap(orderId, { logging: false });
      }
    } catch {
      setTap(orderId, { logging: false });
    }
  }

  async function handleEndSession(orderId: string, currentCount: number, currentDriverCount: number) {
    endingRef.current[orderId] = true;
    setToggling(orderId);
    try {
      const res = await fetch(`/api/haul-orders/${orderId}/pit-session`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ active: false }),
      });
      if (res.ok) {
        const data = await res.json();
        setSummaries((prev) => ({
          ...prev,
          [orderId]: {
            finalCount:    currentCount,
            driverCount:   currentDriverCount,
            cobDueAt:      data.cobDueAt ?? null,
            afterHoursFee: data.afterHoursFeeCents ?? 0,
          },
        }));
        // Remove from active sessions list
        setSessions((prev) => prev.filter((s) => s.orderId !== orderId));
      }
    } catch {}
    setToggling(null);
  }

  // Render completed summaries at the top
  const summaryEntries = Object.entries(summaries);

  if (sessions.length === 0 && summaryEntries.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Session complete summaries */}
      {summaryEntries.map(([orderId, summary]) => {
        const cobTime = summary.cobDueAt
          ? new Date(summary.cobDueAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
          : "5:30 PM";
        return (
          <div key={orderId} className="bg-gray-800 rounded-2xl border border-green-700 p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-bold text-green-400">Session Complete</p>
              <button
                onClick={() => setSummaries((prev) => { const n = { ...prev }; delete n[orderId]; return n; })}
                className="ml-auto text-gray-500 text-xs hover:text-gray-300"
              >
                Dismiss
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-gray-900 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-white">{summary.finalCount}</p>
                <p className="text-xs text-gray-400 mt-0.5">Your Logs</p>
              </div>
              <div className="bg-gray-900 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-blue-400">{summary.driverCount}</p>
                <p className="text-xs text-gray-400 mt-0.5">Driver Count</p>
              </div>
            </div>
            {summary.afterHoursFee > 0 && (
              <p className="text-xs text-amber-400 mb-2">
                After-hours fee applied: +${(summary.afterHoursFee / 100).toFixed(2)}
              </p>
            )}
            <p className="text-xs text-gray-500">
              Payment auto-charges buyer at <span className="text-white font-semibold">{cobTime}</span> today.
            </p>
            {summary.finalCount !== summary.driverCount && (
              <p className="text-xs text-amber-400 mt-1">
                Counts differ by {Math.abs(summary.finalCount - summary.driverCount)} — both saved for dispute resolution.
              </p>
            )}
          </div>
        );
      })}

      {/* Active / pending sessions */}
      {sessions.map((s) => {
        const tap         = getTap(s.orderId);
        const isToggling  = toggling === s.orderId;
        const sessionStart = s.sessionStartedAt
          ? new Date(s.sessionStartedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
          : null;

        return (
          <div
            key={s.orderId}
            className={`rounded-2xl border-2 overflow-hidden ${
              s.sessionActive
                ? "bg-gray-800 border-green-600"
                : "bg-gray-800 border-amber-600"
            }`}
          >
            {/* Order header */}
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${s.sessionActive ? "bg-green-500 animate-pulse" : "bg-amber-500 animate-pulse"}`} />
                  <p className="font-bold text-white text-sm">{s.pitName}</p>
                  {s.manual && (
                    <span className="text-[10px] bg-teal-900 text-teal-300 px-1.5 py-0.5 rounded-full font-semibold">Manual Arrival</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{s.buyerName} · {s.haulerName}</p>
                {sessionStart && (
                  <p className="text-[10px] text-gray-500 mt-0.5">Started {sessionStart}</p>
                )}
              </div>

              {/* Counts */}
              {s.sessionActive && (
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-center">
                    <p className="text-xl font-black text-white leading-none">{s.pitOwnerCount}</p>
                    <p className="text-[10px] text-gray-400">yours</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-black text-blue-400 leading-none">{s.driverCount}</p>
                    <p className="text-[10px] text-gray-400">driver</p>
                  </div>
                </div>
              )}
            </div>

            {/* Session not started — show Start Loading */}
            {!s.sessionActive && !s.sessionCompleted && (
              <div className="px-4 pb-4">
                <p className="text-xs text-amber-400 mb-3">
                  🚛 {s.haulerName} is on site — tap to begin counting loads
                </p>
                <button
                  onClick={() => startSession(s.orderId)}
                  disabled={isToggling}
                  className="w-full bg-amber-500 hover:bg-amber-400 active:scale-95 text-gray-900 font-black text-base rounded-xl py-3.5 transition-all disabled:opacity-50"
                  style={{ touchAction: "manipulation" }}
                >
                  {isToggling ? "Starting…" : "Start Loading"}
                </button>
                {startErrors[s.orderId] && (
                  <p className="text-xs text-red-400 mt-2 text-center leading-snug">
                    {startErrors[s.orderId]}
                  </p>
                )}
              </div>
            )}

            {/* Session active — show LOG LOAD tap button */}
            {s.sessionActive && (
              <div className="px-4 pb-4 space-y-3">
                {tap.lastLogged && (
                  <p className="text-xs text-green-400 text-center">Last logged at {tap.lastLogged}</p>
                )}
                <button
                  onClick={() => handleTap(s.orderId)}
                  disabled={tap.logging}
                  className={`relative w-full rounded-2xl font-black text-xl transition-all active:scale-95 disabled:opacity-60 ${
                    tap.pending
                      ? "bg-amber-500 text-gray-900"
                      : "bg-green-500 text-white hover:bg-green-400"
                  }`}
                  style={{ height: 80, touchAction: "manipulation" }}
                >
                  <span className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity ${tap.pending || tap.logging ? "opacity-0" : "opacity-100"}`}>
                    <span>LOG LOAD</span>
                    <span className="text-xs font-semibold opacity-70 mt-0.5">tap twice to confirm</span>
                  </span>
                  <span className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity ${tap.pending && !tap.logging ? "opacity-100" : "opacity-0"}`}>
                    <span>Tap again to confirm</span>
                  </span>
                  <span className={`absolute inset-0 flex items-center justify-center transition-opacity ${tap.logging ? "opacity-100" : "opacity-0"}`}>
                    Logging…
                  </span>
                </button>

                <button
                  onClick={() => handleEndSession(s.orderId, s.pitOwnerCount, s.driverCount)}
                  disabled={isToggling}
                  className="w-full bg-gray-700 hover:bg-red-900 hover:text-red-400 text-gray-400 rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
                  style={{ touchAction: "manipulation" }}
                >
                  {isToggling ? "Ending…" : "End Session"}
                </button>
              </div>
            )}
          </div>
        );
      })}

      {sessions.length > 0 && (
        <div className="border-t border-gray-800 pt-3 mt-1">
          <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold">Material Orders Below</p>
        </div>
      )}
    </div>
  );
}
