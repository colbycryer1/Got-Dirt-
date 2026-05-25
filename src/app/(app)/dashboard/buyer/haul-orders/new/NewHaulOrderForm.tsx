"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface Project  { id: string; name: string; }
interface PitItem  { id: string; name: string; address?: string; state: string; pitType: string; }
interface Driver   { id: string; name: string; truckType: string; haulRateCents: number; liveLocationEnabled: boolean; }
interface Carrier  { id: string; name: string; haulRateCents: number; }

interface RateSuggestion {
  suggested:  number | null;
  marketMin:  number | null;
  marketMax:  number | null;
  sampleSize: number;
  message:    string | null;
}

interface Props {
  projects:     Project[];
  pits:         PitItem[];
  pitHaulRates: Record<string, number>; // pitId → today's locked haul rate (cents)
  drivers:      Driver[];
  carriers:     Carrier[];
}

const DEPOSIT_PERCENT    = 25;
const RATE_FLOOR_BUFFER  = 1000; // $10 in cents — buyer can't go more than $10 below lowest driver

const TRUCK_TYPES = [
  "Pickup / Flatbed", "Single Axle Dump", "Tandem Axle Dump", "Super 10 Dump",
  "Tri-Axle Dump", "Quad Axle Dump", "Quint Axle Dump", "Semi End Dump",
  "Semi Side Dump", "Belly Dump", "Transfer (Full)", "Other",
];

type Mode       = "direct" | "broadcast" | "self";
type HaulerType = "driver" | "carrier";

export default function NewHaulOrderForm({ projects, pits, pitHaulRates, drivers, carriers }: Props) {
  const router = useRouter();

  const [mode,            setMode]            = useState<Mode>("direct");
  const [haulerType,      setHaulerType]      = useState<HaulerType>("driver");
  const [selectedId,      setSelectedId]      = useState("");
  const [broadcastRate,   setBroadcastRate]   = useState("");
  const [selfTruckType,   setSelfTruckType]   = useState("");
  const [selfRatePerLoad, setSelfRatePerLoad] = useState("");
  const [pitId,           setPitId]           = useState("");
  const [projectId,       setProjectId]       = useState("");
  const [scheduledDate,   setScheduledDate]   = useState("");
  const [loads,           setLoads]           = useState("1");
  const [notes,           setNotes]           = useState("");
  const [expiresIn,       setExpiresIn]       = useState("60");
  const [showDriverList,  setShowDriverList]  = useState(false);
  const [suggestion,      setSuggestion]      = useState<RateSuggestion | null>(null);
  const [submitting,      setSubmitting]      = useState(false);
  const [error,           setError]           = useState("");
  const suggestionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const list     = haulerType === "driver" ? drivers : carriers;
  const selected = mode === "direct" ? list.find((x) => x.id === selectedId) : null;

  // Pit's locked haul rate today (if any)
  const pitLockedRate: number | null = pitId ? (pitHaulRates[pitId] ?? null) : null;

  const rateInCents =
    mode === "direct"    ? (selected?.haulRateCents ?? 0)
    : mode === "broadcast"
      ? (pitLockedRate !== null ? pitLockedRate : Math.round(parseFloat(broadcastRate || "0") * 100))
    : Math.round(parseFloat(selfRatePerLoad || "0") * 100);

  const loadsNum  = parseInt(loads) || 0;
  const total     = rateInCents * loadsNum;
  const deposit   = mode === "self" ? 0 : Math.round(total * DEPOSIT_PERCENT / 100);

  // Lowest active driver rate (for rate floor in broadcast mode)
  const lowestDriverRate = drivers.length > 0
    ? Math.min(...drivers.filter((d) => d.haulRateCents > 0).map((d) => d.haulRateCents))
    : null;
  const rateFloor = lowestDriverRate !== null ? lowestDriverRate - RATE_FLOOR_BUFFER : null;

  // Fetch rate suggestions (debounced) when broadcast rate changes
  useEffect(() => {
    if (mode !== "broadcast" || pitLockedRate !== null) return;
    const cents = Math.round(parseFloat(broadcastRate || "0") * 100);
    if (!cents) { setSuggestion(null); return; }

    if (suggestionTimerRef.current) clearTimeout(suggestionTimerRef.current);
    suggestionTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/haul-orders/rate-suggestions");
        if (res.ok) setSuggestion(await res.json());
      } catch {}
    }, 600);
  }, [broadcastRate, mode, pitLockedRate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "direct" && !selectedId)           { setError("Select a driver or carrier."); return; }
    if (mode === "broadcast" && pitLockedRate === null && rateInCents <= 0) {
      setError("Enter your offered rate per load."); return;
    }
    if (mode === "broadcast" && pitLockedRate === null && rateFloor !== null && rateInCents < rateFloor) {
      setError(`Rate cannot be more than $10 below the lowest active driver rate ($${(lowestDriverRate! / 100).toFixed(2)}/load). Minimum: $${(rateFloor / 100).toFixed(2)}/load.`);
      return;
    }
    if (mode === "self" && !selfTruckType)          { setError("Select your truck type."); return; }
    if (mode === "self" && rateInCents <= 0)        { setError("Enter the cost per load for cost tracking."); return; }
    if (!pitId)                                     { setError("Select the pit you are hauling from."); return; }

    setSubmitting(true);
    setError("");
    try {
      const expiresAt = (mode === "broadcast" || (mode === "direct" && expiresIn))
        ? new Date(Date.now() + parseInt(expiresIn) * 60 * 1000).toISOString()
        : undefined;

      const body: Record<string, unknown> = {
        pitId,
        projectId:           projectId || undefined,
        scheduledDate:       new Date(scheduledDate).toISOString(),
        loads:               loadsNum,
        haulRateCents:       rateInCents,
        totalEstimatedCents: total,
        depositHoldCents:    deposit,
        notes:               notes || undefined,
      };

      if (mode === "direct") {
        body.broadcast = false;
        body[haulerType === "driver" ? "driverId" : "carrierId"] = selectedId;
        body.expiresAt = expiresAt;
      } else if (mode === "broadcast") {
        body.broadcast = true;
        body.expiresAt = expiresAt;
      } else {
        body.broadcast              = false;
        body.buyerOperating         = true;
        body.operatorTruckType      = selfTruckType;
        body.operatorTruckRateCents = rateInCents;
      }

      const res = await fetch("/api/haul-orders", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create order");
      }
      const { order, clientSecret } = await res.json();
      if (clientSecret) {
        router.push(`/dashboard/buyer/haul-orders/${order.id}/pay?secret=${encodeURIComponent(clientSecret)}`);
      } else {
        router.push("/dashboard/buyer/haul-orders");
        router.refresh();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create order.");
      setSubmitting(false);
    }
  }

  const inputClass = "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500";
  const labelClass = "text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1";

  const liveDrivers    = drivers.filter((d) => d.liveLocationEnabled && d.haulRateCents > 0);
  const offlineDrivers = drivers.filter((d) => !d.liveLocationEnabled && d.haulRateCents > 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Mode toggle */}
      <div>
        <label className={labelClass}>Request Type</label>
        <div className="flex rounded-xl border border-gray-200 overflow-hidden">
          {([
            { key: "direct",    label: "Direct Request" },
            { key: "broadcast", label: "Open Broadcast" },
            { key: "self",      label: "Buyer / Operator" },
          ] as { key: Mode; label: string }[]).map((m) => (
            <button key={m.key} type="button"
              onClick={() => { setMode(m.key); setSelectedId(""); setSuggestion(null); }}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors
                ${mode === m.key ? "bg-amber-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
              {m.label}
            </button>
          ))}
        </div>
        {mode === "broadcast" && (
          <p className="text-xs text-gray-400 mt-2">
            {pitLockedRate !== null
              ? "This pit has a locked daily haul rate — broadcast goes to all verified drivers and carriers."
              : "Buyer-rate broadcasts go to verified independent drivers only. Select a pit with a locked daily rate to include carriers."}
          </p>
        )}
        {mode === "self" && (
          <p className="text-xs text-gray-400 mt-2">
            Use your own truck. Rate entered is for internal cost tracking and project/job cost reporting — no payment is processed.
          </p>
        )}
      </div>

      {/* Direct mode: hauler type + selection */}
      {mode === "direct" && (
        <>
          <div>
            <label className={labelClass}>Haul by</label>
            <div className="flex rounded-xl border border-gray-200 overflow-hidden">
              {(["driver", "carrier"] as HaulerType[]).map((t) => (
                <button key={t} type="button"
                  onClick={() => { setHaulerType(t); setSelectedId(""); }}
                  className={`flex-1 py-2.5 text-sm font-semibold transition-colors
                    ${haulerType === t ? "bg-amber-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                  {t === "driver" ? "Independent Driver" : "3PL / Trucking Company"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass}>{haulerType === "driver" ? "Select Driver" : "Select Carrier"} *</label>
            {list.length === 0 ? (
              <p className="text-sm text-gray-400 py-3">
                No {haulerType === "driver" ? "verified drivers" : "carriers"} available.
                Try the map or use Open Broadcast.
              </p>
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
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                          {haulerType === "driver" && (item as Driver).liveLocationEnabled && (
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" title="Live" />
                          )}
                        </div>
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
        </>
      )}

      {/* Broadcast mode: rate input (or pit-locked rate) + suggestions + driver reference */}
      {mode === "broadcast" && (
        <>
          {pitLockedRate !== null ? (
            /* Pit-rate broadcast — rate is locked by pit owner */
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <p className="text-sm font-bold text-green-800">Rate Locked by Pit Owner</p>
              </div>
              <p className="text-2xl font-black text-green-900">${(pitLockedRate / 100).toFixed(2)}<span className="text-sm font-normal text-gray-500">/load</span></p>
              <p className="text-xs text-green-700 mt-1">
                This broadcast will go to all verified independent drivers and 3PL carriers.
              </p>
            </div>
          ) : (
            /* Buyer-rate broadcast */
            <div className="space-y-2">
              <label className={labelClass}>Your Offered Rate (per load) *</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  required
                  type="number"
                  min="1"
                  step="0.01"
                  value={broadcastRate}
                  onChange={(e) => setBroadcastRate(e.target.value)}
                  placeholder="0.00"
                  className={`${inputClass} pl-8`}
                />
              </div>

              {/* Rate floor warning */}
              {rateFloor !== null && rateInCents > 0 && rateInCents < rateFloor && (
                <p className="text-xs text-red-600 font-semibold">
                  Rate is more than $10 below the lowest active driver (${(lowestDriverRate! / 100).toFixed(2)}/load). Minimum: ${(rateFloor / 100).toFixed(2)}/load.
                </p>
              )}

              {/* Market rate suggestion */}
              {suggestion && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs space-y-1">
                  <p className="font-semibold text-blue-800">Market Rate Insight · Got Dirt? Data</p>
                  {suggestion.suggested !== null ? (
                    <>
                      <p className="text-blue-700">
                        Suggested: <strong>${(suggestion.suggested / 100).toFixed(2)}/load</strong> — highest acceptance rate in your area
                      </p>
                      {suggestion.marketMin !== null && suggestion.marketMax !== null && (
                        <p className="text-blue-600">
                          Market range: ${(suggestion.marketMin / 100).toFixed(2)} – ${(suggestion.marketMax / 100).toFixed(2)} /load
                          <span className="text-blue-400"> ({suggestion.sampleSize} completed orders)</span>
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-blue-600 italic">{suggestion.message}</p>
                  )}
                </div>
              )}

              <p className="text-xs text-gray-400">
                Set a competitive rate — haulers see this when deciding whether to claim the job.
                <br />
                <em>Based on data collected by Got Dirt LLC. Suggestions are for reference only.</em>
              </p>

              {/* Active driver rates reference — collapsible */}
              {drivers.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowDriverList(!showDriverList)}
                    className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <span>Active Driver Rates ({drivers.length} available)</span>
                    <span>{showDriverList ? "▲ Hide" : "▼ Show"}</span>
                  </button>
                  {showDriverList && (
                    <div className="divide-y divide-gray-100 max-h-56 overflow-y-auto">
                      {liveDrivers.length > 0 && (
                        <>
                          <div className="px-4 py-1.5 bg-green-50">
                            <p className="text-xs font-semibold text-green-700">Live Now</p>
                          </div>
                          {liveDrivers.map((d) => (
                            <div key={d.id} className="flex items-center justify-between px-4 py-2.5">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                  <p className="text-xs font-semibold text-gray-800">{d.name}</p>
                                </div>
                                {d.truckType && <p className="text-xs text-gray-400 pl-3">{d.truckType}</p>}
                              </div>
                              <p className="text-xs font-bold text-gray-900">${(d.haulRateCents / 100).toFixed(2)}/load</p>
                            </div>
                          ))}
                        </>
                      )}
                      {offlineDrivers.length > 0 && (
                        <>
                          {liveDrivers.length > 0 && (
                            <div className="px-4 py-1.5 bg-gray-50">
                              <p className="text-xs font-semibold text-gray-500">Offline / Available</p>
                            </div>
                          )}
                          {offlineDrivers.map((d) => (
                            <div key={d.id} className="flex items-center justify-between px-4 py-2.5">
                              <div>
                                <p className="text-xs font-semibold text-gray-700">{d.name}</p>
                                {d.truckType && <p className="text-xs text-gray-400">{d.truckType}</p>}
                              </div>
                              <p className="text-xs font-bold text-gray-900">${(d.haulRateCents / 100).toFixed(2)}/load</p>
                            </div>
                          ))}
                        </>
                      )}
                      <div className="px-4 py-2 bg-amber-50">
                        <p className="text-xs text-amber-700">
                          Tip: Rates shown are drivers&apos; posted rates. Your offered rate must be within $10 of the lowest listed rate.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Buyer/Operator mode */}
      {mode === "self" && (
        <>
          <div>
            <label className={labelClass}>Truck Type *</label>
            <select required value={selfTruckType} onChange={(e) => setSelfTruckType(e.target.value)} className={inputClass}>
              <option value="">— Select truck type —</option>
              {TRUCK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Cost Per Load (for internal accounting) *</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input required type="number" min="0" step="0.01" value={selfRatePerLoad}
                onChange={(e) => setSelfRatePerLoad(e.target.value)} placeholder="0.00"
                className={`${inputClass} pl-8`} />
            </div>
            <p className="text-xs text-gray-400 mt-1">Used for Procore, ACC, and accounting software job cost exports. No charge collected.</p>
          </div>
        </>
      )}

      {/* Pit — required */}
      <div>
        <label className={labelClass}>Pickup Pit *</label>
        {pits.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">No active pits available.</p>
        ) : (
          <select required value={pitId} onChange={(e) => setPitId(e.target.value)} className={inputClass}>
            <option value="">— Select a pit —</option>
            {pits.map((p) => {
              const lockedRate = pitHaulRates[p.id];
              return (
                <option key={p.id} value={p.id}>
                  {p.name}{p.address ? ` — ${p.address}` : ""}, {p.state}
                  {lockedRate ? ` · Haul rate locked $${(lockedRate / 100).toFixed(2)}/load` : ""}
                </option>
              );
            })}
          </select>
        )}
        <p className="text-xs text-gray-400 mt-1">
          Loads logged at this pit auto-track to this order.
          {pitLockedRate !== null && mode === "broadcast" && (
            <strong className="text-green-700"> Pit rate locked — broadcast reaches all haulers.</strong>
          )}
        </p>
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
          <label className={labelClass}>Pickup / Delivery Date & Time *</label>
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

      {/* FCFS expiry */}
      {mode !== "self" && (
        <div className="py-3 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-gray-700">
              {mode === "broadcast" ? "Broadcast Expiry" : "First-Come, First-Served Expiry"}
            </span>
            {mode === "broadcast" && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">Required</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Expires in</span>
            <select value={expiresIn} onChange={(e) => setExpiresIn(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1">
              <option value="30">30 min</option>
              <option value="60">1 hour</option>
              <option value="120">2 hours</option>
              <option value="240">4 hours</option>
              <option value="1440">24 hours</option>
            </select>
          </div>
        </div>
      )}

      {/* Order summary */}
      {loadsNum > 0 && rateInCents > 0 && (
        <div className="bg-gray-50 rounded-2xl p-5 space-y-2">
          <p className="text-sm font-semibold text-gray-700 mb-3">
            {mode === "self" ? "Cost Summary (Internal)" : "Order Summary"}
          </p>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{loadsNum} load{loadsNum !== 1 ? "s" : ""} × ${(rateInCents / 100).toFixed(2)}</span>
            <span className="font-semibold">${(total / 100).toFixed(2)}</span>
          </div>
          {mode !== "self" && (
            <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
              <span className="text-gray-500">Deposit hold ({DEPOSIT_PERCENT}%)</span>
              <span className="font-bold text-amber-700">${(deposit / 100).toFixed(2)}</span>
            </div>
          )}
          {mode === "self"
            ? <p className="text-xs text-gray-400">Internal cost only — no charge collected. Exported to your project accounting.</p>
            : <p className="text-xs text-gray-400">Card is authorized now, charged after haul completion.</p>
          }
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit"
        disabled={
          submitting
          || !pitId
          || (mode === "direct" && !selectedId)
          || (mode === "broadcast" && pitLockedRate === null && rateInCents <= 0)
          || (mode === "self" && (!selfTruckType || rateInCents <= 0))
        }
        className="w-full bg-amber-600 text-white py-3 rounded-xl font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors">
        {submitting
          ? "Saving…"
          : mode === "broadcast" ? "Broadcast Haul Job"
          : mode === "self"      ? "Save Self-Haul Order"
          : "Send Haul Request"}
      </button>
    </form>
  );
}
