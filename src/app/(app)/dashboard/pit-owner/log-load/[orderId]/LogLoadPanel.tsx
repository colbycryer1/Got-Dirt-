"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface TapEntry { id: string; loggedAt: string; }

interface Props {
  orderId:          string;
  pitName:          string;
  buyerName:        string;
  haulerName:       string;
  estimatedLoads:   number;
  scheduledDateStr: string;
  initialCount:     number;
  initialDriverCount: number;
  sessionStartedAt: string | null;
}

const POLL_MS          = 10_000;
const CONFIRM_MS       = 4_000; // double-tap window

export default function LogLoadPanel({
  orderId, pitName, buyerName, haulerName,
  estimatedLoads, scheduledDateStr,
  initialCount, initialDriverCount, sessionStartedAt,
}: Props) {
  const router = useRouter();

  const [pitCount,    setPitCount]    = useState(initialCount);
  const [driverCount, setDriverCount] = useState(initialDriverCount);
  const [logs,        setLogs]        = useState<TapEntry[]>([]);
  const [logging,     setLogging]     = useState(false);
  const [ending,      setEnding]      = useState(false);
  const [lastLogged,  setLastLogged]  = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState(false);

  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Poll for live counts + driver count
  const poll = useCallback(async () => {
    try {
      const [sessionRes, logRes] = await Promise.all([
        fetch(`/api/haul-orders/${orderId}/pit-session`),
        fetch(`/api/haul-orders/${orderId}/pit-log`),
      ]);
      if (sessionRes.ok) {
        const data = await sessionRes.json();
        setPitCount(data.pitOwnerCount ?? 0);
        setDriverCount(data.driverCount ?? 0);
        if (!data.active) {
          // Session ended externally — go back to dashboard
          router.replace("/dashboard/pit-owner");
        }
      }
      if (logRes.ok) {
        const data = await logRes.json();
        setLogs(data.logs ?? []);
      }
    } catch {}
  }, [orderId, router]);

  useEffect(() => {
    poll();
    const iv = setInterval(poll, POLL_MS);
    return () => clearInterval(iv);
  }, [poll]);

  async function handleTap() {
    if (logging) return;

    if (!pendingConfirm) {
      setPendingConfirm(true);
      confirmTimerRef.current = setTimeout(() => setPendingConfirm(false), CONFIRM_MS);
      return;
    }

    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setPendingConfirm(false);
    setLogging(true);
    try {
      const res = await fetch(`/api/haul-orders/${orderId}/pit-log`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setPitCount(data.count);
        setLastLogged(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
        // Refresh tap list
        const logRes = await fetch(`/api/haul-orders/${orderId}/pit-log`);
        if (logRes.ok) setLogs((await logRes.json()).logs ?? []);
      }
    } catch {}
    setLogging(false);
  }

  async function handleEndSession() {
    if (ending) return;
    setEnding(true);
    try {
      await fetch(`/api/haul-orders/${orderId}/pit-session`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ active: false }),
      });
    } catch {}
    router.replace("/dashboard/pit-owner");
  }

  const sessionStart = sessionStartedAt
    ? new Date(sessionStartedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-4 bg-gray-800">
        <button
          onClick={() => router.back()}
          className="text-gray-400 text-sm font-medium hover:text-white"
        >
          ← Back
        </button>
        <p className="font-black text-white text-lg tracking-wide">LOG LOAD</p>
        <button
          onClick={handleEndSession}
          disabled={ending}
          className="text-red-400 text-sm font-bold hover:text-red-300 disabled:opacity-50"
        >
          {ending ? "Ending…" : "End Session"}
        </button>
      </div>

      {/* Order info */}
      <div className="bg-gray-800 border-t border-gray-700 px-5 py-3">
        <p className="font-bold text-white text-base">{pitName}</p>
        <p className="text-sm text-gray-400">{buyerName} · {haulerName}</p>
        <p className="text-xs text-gray-500 mt-0.5">{scheduledDateStr}</p>
      </div>

      {/* Live counts */}
      <div className="grid grid-cols-2 gap-px bg-gray-700 border-t border-b border-gray-700">
        <div className="bg-gray-800 flex flex-col items-center justify-center py-6">
          <p className="text-5xl font-black text-white">{pitCount}</p>
          <p className="text-xs text-gray-400 mt-1 uppercase tracking-wide">Your Count</p>
          <p className="text-xs text-gray-500">/ {estimatedLoads} est.</p>
        </div>
        <div className="bg-gray-800 flex flex-col items-center justify-center py-6">
          <p className="text-5xl font-black text-blue-400">{driverCount}</p>
          <p className="text-xs text-gray-400 mt-1 uppercase tracking-wide">Driver Count</p>
          <p className="text-xs text-gray-500">GPS verified</p>
        </div>
      </div>

      {/* Session start time */}
      {sessionStart && (
        <p className="text-center text-xs text-gray-500 py-2">
          Session started at {sessionStart}
          {lastLogged && <span className="ml-3 text-green-400">Last logged {lastLogged}</span>}
        </p>
      )}

      {/* TAP BUTTON */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
        <button
          onClick={handleTap}
          disabled={logging}
          className={`relative w-full rounded-3xl font-black text-2xl tracking-wide transition-all active:scale-95 disabled:opacity-60
            ${pendingConfirm
              ? "bg-amber-500 text-white shadow-amber-500/40 shadow-2xl"
              : "bg-green-500 text-white shadow-green-500/40 shadow-2xl hover:bg-green-400"
            }`}
          style={{ height: 160, touchAction: "manipulation" }}
        >
          <span className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity
            ${pendingConfirm || logging ? "opacity-0" : "opacity-100"}`}>
            <span>LOG LOAD</span>
            <span className="text-sm font-semibold text-green-200 mt-1">tap twice to confirm</span>
          </span>
          <span className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity
            ${pendingConfirm && !logging ? "opacity-100" : "opacity-0"}`}>
            <span>Tap again</span>
            <span className="text-sm font-semibold text-amber-100 mt-1">to confirm load</span>
          </span>
          <span className={`absolute inset-0 flex items-center justify-center transition-opacity
            ${logging ? "opacity-100" : "opacity-0"}`}>
            Logging…
          </span>
        </button>

        {pitCount !== driverCount && pitCount > 0 && driverCount > 0 && (
          <p className="text-xs text-amber-400 text-center">
            Counts differ by {Math.abs(pitCount - driverCount)} — both are recorded for dispute resolution
          </p>
        )}
      </div>

      {/* Tap timeline */}
      {logs.length > 0 && (
        <div className="px-5 pb-6">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Tap Log — {logs.length} loads</p>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {logs.map((log, i) => (
              <div key={log.id} className="bg-gray-800 rounded-xl py-2 px-1 text-center">
                <p className="text-xs font-bold text-white">#{i + 1}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">
                  {new Date(log.loggedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
