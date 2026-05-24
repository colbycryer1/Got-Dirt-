"use client";

import Link from "next/link";
import { PitSummary } from "@/types";
import { useState, useEffect } from "react";

interface Props {
  pits: PitSummary[];
  selectedIndex: number | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
  loggedIn: boolean;
}

export default function PitModal({ pits, selectedIndex, onClose, onNavigate, loggedIn }: Props) {
  const [saved, setSaved] = useState(false);
  const [savingLoading, setSavingLoading] = useState(false);

  const pit = selectedIndex !== null ? pits[selectedIndex] : null;
  const total = pits.length;
  const hasPrev = selectedIndex !== null && selectedIndex > 0;
  const hasNext = selectedIndex !== null && selectedIndex < total - 1;

  useEffect(() => {
    if (!pit || !loggedIn) { setSaved(false); return; }
    fetch("/api/saved-pits")
      .then((r) => r.json())
      .then((d) => {
        const ids = (d.saved ?? []).map((s: { pit: { id: string } }) => s.pit.id);
        setSaved(ids.includes(pit.id));
      })
      .catch(() => {});
  }, [pit, loggedIn]);

  async function toggleSave() {
    if (!pit) return;
    setSavingLoading(true);
    if (saved) {
      await fetch(`/api/saved-pits/${pit.id}`, { method: "DELETE" });
      setSaved(false);
    } else {
      await fetch(`/api/saved-pits/${pit.id}`, { method: "POST" });
      setSaved(true);
    }
    setSavingLoading(false);
  }

  if (!pit || selectedIndex === null) return null;

  const typeLabel =
    pit.pitType === "WASTE" ? "Waste Pit" :
    pit.pitType === "BORROW" ? "Borrow Pit" : "Waste & Borrow";

  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <>
      {/* Backdrop (mobile only) */}
      <div
        className="fixed inset-0 bg-black/30 z-40 md:hidden"
        onClick={onClose}
      />

      {/* Panel — right sidebar on desktop, bottom sheet on mobile */}
      <div className="
        fixed z-50 bg-white shadow-2xl overflow-y-auto
        bottom-0 left-0 right-0 max-h-[85vh] rounded-t-2xl
        md:top-0 md:right-0 md:bottom-0 md:left-auto md:w-96 md:max-h-none md:rounded-none md:rounded-l-2xl
        animate-slide-up md:animate-none
      ">
        {/* Mobile drag handle */}
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 md:hidden" />

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-bold text-gray-900 text-lg leading-tight truncate">{pit.name}</h2>
            {pit.address && (
              <p className="text-sm text-gray-500 mt-0.5 truncate">{pit.address}, {pit.state}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl shrink-0 mt-0.5">✕</button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Badges */}
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">{typeLabel}</span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
              pit.accepting ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}>
              {pit.accepting ? "● Open" : "● Closed"}
            </span>
            {loggedIn && (
              <button
                onClick={toggleSave}
                disabled={savingLoading}
                title={saved ? "Remove from saved" : "Save pit"}
                className={`ml-auto px-3 py-1 rounded-full border text-xs font-medium transition-colors disabled:opacity-50 ${
                  saved ? "bg-amber-50 border-amber-300 text-amber-700" : "bg-white border-gray-200 text-gray-600"
                }`}
              >
                {saved ? "📌 Saved" : "🔖 Save"}
              </button>
            )}
          </div>

          {/* Rates */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Rates</p>
            {!pit.dumpRateCents && !pit.borrowRateCents && !pit.topsoilRateCents ? (
              <p className="text-sm text-gray-400">No rates listed</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {pit.dumpRateCents && (
                  <div className="bg-orange-50 rounded-xl p-3">
                    <p className="text-xs text-orange-500 font-semibold uppercase tracking-wide">Dump</p>
                    <p className="text-xl font-bold text-orange-900">{fmt(pit.dumpRateCents)}</p>
                    <p className="text-xs text-orange-400">per load</p>
                  </div>
                )}
                {pit.borrowRateCents && (
                  <div className="bg-blue-50 rounded-xl p-3">
                    <p className="text-xs text-blue-500 font-semibold uppercase tracking-wide">Borrow</p>
                    <p className="text-xl font-bold text-blue-900">{fmt(pit.borrowRateCents)}</p>
                    <p className="text-xs text-blue-400">per load</p>
                  </div>
                )}
                {pit.hasTopsoil && pit.topsoilRateCents && (
                  <div className="bg-amber-50 rounded-xl p-3">
                    <p className="text-xs text-amber-500 font-semibold uppercase tracking-wide">Topsoil</p>
                    <p className="text-xl font-bold text-amber-900">{fmt(pit.topsoilRateCents)}</p>
                    <p className="text-xs text-amber-400">per load</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Materials */}
          {pit.materialTypes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Available Materials</p>
              <div className="flex flex-wrap gap-1.5">
                {pit.materialTypes.map((m) => (
                  <span key={m} className="bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-full font-medium">{m}</span>
                ))}
              </div>
            </div>
          )}

          {/* Hours */}
          {(pit.hoursOpen || pit.hoursClose) && (
            <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 px-3 py-2.5 rounded-xl">
              <span>🕐</span>
              <span>Hours: <span className="font-semibold">{pit.hoursOpen ?? "—"} – {pit.hoursClose ?? "—"}</span></span>
            </div>
          )}

          {/* Operator & Equipment */}
          <div className="grid grid-cols-2 gap-2">
            <div className={`rounded-xl p-3 flex items-start gap-2 ${pit.operatorProvided ? "bg-sky-50 border border-sky-200" : "bg-gray-50 border border-gray-100"}`}>
              <span className="text-base mt-0.5">{pit.operatorProvided ? "✅" : "➖"}</span>
              <div>
                <p className={`text-xs font-semibold ${pit.operatorProvided ? "text-sky-800" : "text-gray-400"}`}>
                  Operator {pit.operatorProvided ? "Provided" : "Not Provided"}
                </p>
              </div>
            </div>
            <div className={`rounded-xl p-3 flex items-start gap-2 ${pit.equipmentProvided ? "bg-sky-50 border border-sky-200" : "bg-gray-50 border border-gray-100"}`}>
              <span className="text-base mt-0.5">{pit.equipmentProvided ? "✅" : "➖"}</span>
              <div>
                <p className={`text-xs font-semibold ${pit.equipmentProvided ? "text-sky-800" : "text-gray-400"}`}>
                  Equipment {pit.equipmentProvided ? "On Site" : "Not Provided"}
                </p>
                {pit.equipmentNotes && <p className="text-xs text-gray-500 mt-0.5">{pit.equipmentNotes}</p>}
              </div>
            </div>
          </div>

          {/* Contact */}
          {(pit.contactName || pit.contactPhone || pit.contactEmail) && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Contact</p>
              {pit.contactName && <p className="text-sm font-medium text-gray-800">{pit.contactName}</p>}
              {pit.contactPhone && (
                <a href={`tel:${pit.contactPhone}`} className="text-sm text-amber-600 hover:underline block">{pit.contactPhone}</a>
              )}
              {pit.contactEmail && (
                <a href={`mailto:${pit.contactEmail}`} className="text-sm text-amber-600 hover:underline block">{pit.contactEmail}</a>
              )}
            </div>
          )}

          {/* Notes */}
          {pit.notes && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Notes</p>
              <p className="text-sm text-gray-600 leading-relaxed">{pit.notes}</p>
            </div>
          )}

          {/* CTA */}
          <Link
            href={`/pit/${pit.id}`}
            className="flex items-center justify-center w-full bg-green-700 text-white py-3 rounded-xl font-semibold text-sm hover:bg-green-800 transition-colors"
          >
            Full Details & Order →
          </Link>
        </div>

        {/* Prev / Next navigation */}
        {total > 1 && (
          <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3 flex items-center justify-between">
            <button
              onClick={() => hasPrev && onNavigate(selectedIndex - 1)}
              disabled={!hasPrev}
              className="flex items-center gap-1 text-sm font-medium text-gray-600 disabled:opacity-30 hover:text-gray-900"
            >
              ← Prev
            </button>
            <span className="text-xs text-gray-400">{selectedIndex + 1} of {total}</span>
            <button
              onClick={() => hasNext && onNavigate(selectedIndex + 1)}
              disabled={!hasNext}
              className="flex items-center gap-1 text-sm font-medium text-gray-600 disabled:opacity-30 hover:text-gray-900"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </>
  );
}
