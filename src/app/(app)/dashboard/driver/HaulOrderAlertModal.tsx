"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface PendingOrder {
  id: string;
  loads: number;
  haulRateCents: number;
  totalEstimatedCents: number;
  scheduledDate: string;
  expiresAt: string | null;
  notes: string | null;
  buyer:   { name: string | null; company: string | null; phone: string | null };
  pit:     { name: string; state: string } | null;
  project: { name: string } | null;
}

const POLL_MS      = 30_000;
const SESSION_KEY  = "gd_seen_haul_orders";

export default function HaulOrderAlertModal() {
  const router = useRouter();
  const [queue,      setQueue]      = useState<PendingOrder[]>([]);
  const [responding, setResponding] = useState(false);
  const [error,      setError]      = useState("");
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) seenRef.current = new Set(JSON.parse(raw) as string[]);
    } catch { /* ignore */ }

    async function poll() {
      try {
        const res = await fetch("/api/driver/pending-orders", { cache: "no-store" });
        if (!res.ok) return;
        const { orders } = (await res.json()) as { orders: PendingOrder[] };
        const fresh = orders.filter((o) => !seenRef.current.has(o.id));
        if (!fresh.length) return;
        fresh.forEach((o) => seenRef.current.add(o.id));
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(Array.from(seenRef.current)));
        setQueue((prev) => {
          const existing = new Set(prev.map((o) => o.id));
          return [...prev, ...fresh.filter((o) => !existing.has(o.id))];
        });
      } catch { /* ignore */ }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, []);

  const current = queue[0];
  if (!current) return null;

  function dismiss() {
    setQueue((prev) => prev.slice(1));
    setError("");
    setResponding(false);
  }

  async function respond(action: "CONFIRM" | "DENY") {
    setResponding(true);
    setError("");
    try {
      const res = await fetch(`/api/haul-orders/${current.id}/respond`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? "Failed to respond");
      }
      dismiss();
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setResponding(false);
    }
  }

  const estPayout = current.totalEstimatedCents > 0
    ? current.totalEstimatedCents
    : current.haulRateCents * current.loads;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <span className="inline-flex items-center gap-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
              </span>
              <h2 className="text-lg font-bold text-gray-900">New Haul Request</h2>
            </span>
            {queue.length > 1 && (
              <p className="text-xs text-gray-400 mt-0.5 ml-4">{queue.length} requests waiting</p>
            )}
          </div>
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="text-gray-400 hover:text-gray-600 text-3xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-0.5">Requested By</p>
              <p className="font-bold text-gray-900">{current.buyer.company ?? current.buyer.name ?? "Buyer"}</p>
              {current.buyer.phone && (
                <p className="text-sm text-gray-500">{current.buyer.phone}</p>
              )}
            </div>

            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-0.5">Scheduled</p>
              <p className="font-medium text-gray-800 text-sm">
                {new Date(current.scheduledDate).toLocaleDateString("en-US", {
                  weekday: "short", month: "short", day: "numeric",
                })}
              </p>
              <p className="text-sm text-gray-500">
                {new Date(current.scheduledDate).toLocaleTimeString("en-US", {
                  hour: "numeric", minute: "2-digit",
                })}
              </p>
            </div>
          </div>

          {current.pit && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-0.5">Location</p>
              <p className="font-medium text-gray-800">{current.pit.name} · {current.pit.state}</p>
              {current.project && <p className="text-xs text-gray-500">{current.project.name}</p>}
            </div>
          )}

          {current.expiresAt && (
            <p className="text-xs text-red-500 font-medium">
              ⏱ Expires {new Date(current.expiresAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </p>
          )}

          {current.notes && (
            <div className="bg-gray-50 rounded-xl px-4 py-2.5 text-sm text-gray-600 italic">
              &ldquo;{current.notes}&rdquo;
            </div>
          )}

          {/* Estimated payout — highlighted */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs text-amber-600 uppercase tracking-wide font-semibold mb-1">
              Estimated Payout
            </p>
            <p className="text-3xl font-black text-amber-800">
              ${(estPayout / 100).toFixed(2)}
            </p>
            <p className="text-sm text-amber-600 mt-0.5">
              {current.loads} load{current.loads !== 1 ? "s" : ""} &times; ${(current.haulRateCents / 100).toFixed(2)}/load
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {/* Actions */}
        <div className="p-5 pt-0 flex gap-3">
          <button
            onClick={() => respond("CONFIRM")}
            disabled={responding}
            className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {responding ? "…" : "Accept"}
          </button>
          <button
            onClick={() => respond("DENY")}
            disabled={responding}
            className="flex-1 bg-white border-2 border-gray-200 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Deny
          </button>
        </div>

      </div>
    </div>
  );
}
