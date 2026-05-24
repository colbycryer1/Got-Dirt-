"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Project  { id: string; name: string; }
interface Driver   { id: string; name: string; truckType: string; haulRateCents: number; }
interface Carrier  { id: string; name: string; haulRateCents: number; }

interface Props {
  projects: Project[];
  drivers:  Driver[];
  carriers: Carrier[];
}

const DEPOSIT_PERCENT = 25; // 25% deposit hold at order placement

export default function NewHaulOrderForm({ projects, drivers, carriers }: Props) {
  const router = useRouter();
  const [haulerType, setHaulerType]     = useState<"driver" | "carrier">("driver");
  const [selectedId, setSelectedId]     = useState("");
  const [projectId,  setProjectId]      = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [loads,      setLoads]          = useState("1");
  const [notes,      setNotes]          = useState("");
  const [fcfs,       setFcfs]           = useState(false);
  const [expiresIn,  setExpiresIn]      = useState("60"); // minutes
  const [submitting, setSubmitting]     = useState(false);
  const [error,      setError]          = useState("");

  const list = haulerType === "driver" ? drivers : carriers;
  const selected = list.find((x) => x.id === selectedId);
  const rate = selected?.haulRateCents ?? 0;
  const loadsNum = parseInt(loads) || 0;
  const total    = rate * loadsNum;
  const deposit  = Math.round(total * DEPOSIT_PERCENT / 100);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) { setError("Select a driver or carrier."); return; }
    setSubmitting(true);
    setError("");
    try {
      const expiresAt = fcfs
        ? new Date(Date.now() + parseInt(expiresIn) * 60 * 1000).toISOString()
        : undefined;

      const res = await fetch("/api/haul-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [haulerType === "driver" ? "driverId" : "carrierId"]: selectedId,
          projectId:          projectId || undefined,
          scheduledDate:      new Date(scheduledDate).toISOString(),
          loads:              loadsNum,
          haulRateCents:      rate,
          totalEstimatedCents: total,
          depositHoldCents:   deposit,
          notes:              notes || undefined,
          expiresAt,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create order");
      }
      router.push("/dashboard/buyer/haul-orders");
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create order.");
      setSubmitting(false);
    }
  }

  const inputClass = "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500";
  const labelClass = "text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Hauler type toggle */}
      <div>
        <label className={labelClass}>Haul by</label>
        <div className="flex rounded-xl border border-gray-200 overflow-hidden">
          {(["driver", "carrier"] as const).map((t) => (
            <button key={t} type="button" onClick={() => { setHaulerType(t); setSelectedId(""); }}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors
                ${haulerType === t ? "bg-amber-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
              {t === "driver" ? "Independent Driver" : "3PL / Trucking Company"}
            </button>
          ))}
        </div>
      </div>

      {/* Select hauler */}
      <div>
        <label className={labelClass}>{haulerType === "driver" ? "Select Driver" : "Select Carrier"} *</label>
        {list.length === 0 ? (
          <p className="text-sm text-gray-400 py-3">No {haulerType === "driver" ? "verified drivers" : "carriers"} available. Try the map to find drivers near your job site.</p>
        ) : (
          <div className="space-y-2">
            {list.map((item) => (
              <label key={item.id}
                className={`flex items-center justify-between gap-4 p-4 rounded-xl border cursor-pointer transition-colors
                  ${selectedId === item.id ? "border-amber-500 bg-amber-50" : "border-gray-200 hover:border-amber-300"}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <input type="radio" name="hauler" value={item.id} checked={selectedId === item.id}
                    onChange={() => setSelectedId(item.id)} className="accent-amber-600" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                    {haulerType === "driver" && (item as Driver).truckType && (
                      <p className="text-xs text-gray-500">{(item as Driver).truckType}</p>
                    )}
                  </div>
                </div>
                <p className="text-sm font-bold text-gray-900 shrink-0">
                  ${(item.haulRateCents / 100).toFixed(2)}<span className="text-xs font-normal text-gray-400">/load</span>
                </p>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Project */}
      {projects.length > 0 && (
        <div>
          <label className={labelClass}>Link to Project (optional)</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputClass}>
            <option value="">No project</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      {/* Date / time */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Date & Time *</label>
          <input required type="datetime-local" value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Number of Loads *</label>
          <input required type="number" min="1" value={loads}
            onChange={(e) => setLoads(e.target.value)} className={inputClass} />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className={labelClass}>Notes / Instructions (optional)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
          placeholder="Job site address, gate code, material type needed…"
          className={`${inputClass} resize-none`} />
      </div>

      {/* First-come-first-served */}
      <div className="flex items-start gap-3 py-3 border-t border-gray-100">
        <input type="checkbox" id="fcfs" checked={fcfs} onChange={(e) => setFcfs(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-amber-600" />
        <div className="min-w-0">
          <label htmlFor="fcfs" className="text-sm font-semibold text-gray-700 cursor-pointer">
            First-Come, First-Served
          </label>
          <p className="text-xs text-gray-400">The order expires if not accepted within a time window. Sent to multiple haulers simultaneously.</p>
          {fcfs && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-gray-500">Expires in</span>
              <select value={expiresIn} onChange={(e) => setExpiresIn(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1">
                <option value="30">30 min</option>
                <option value="60">1 hour</option>
                <option value="120">2 hours</option>
                <option value="240">4 hours</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Order summary */}
      {selected && loadsNum > 0 && (
        <div className="bg-gray-50 rounded-2xl p-5 space-y-2">
          <p className="text-sm font-semibold text-gray-700 mb-3">Order Summary</p>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{loadsNum} load{loadsNum !== 1 ? "s" : ""} × ${(rate / 100).toFixed(2)}</span>
            <span className="font-semibold">${(total / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
            <span className="text-gray-500">Deposit hold at booking ({DEPOSIT_PERCENT}%)</span>
            <span className="font-bold text-amber-700">${(deposit / 100).toFixed(2)}</span>
          </div>
          <p className="text-xs text-gray-400">The remaining balance is charged after haul completion.</p>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={submitting || !selectedId}
        className="w-full bg-amber-600 text-white py-3 rounded-xl font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors">
        {submitting ? "Sending…" : "Send Haul Request"}
      </button>
    </form>
  );
}
