"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PitSummary } from "@/types";

interface Props {
  pit: PitSummary | null;
  onClose: () => void;
  loggedIn: boolean;
}

export default function PitBottomSheet({ pit, onClose, loggedIn }: Props) {
  const [saved, setSaved] = useState(false);
  const [savingLoading, setSavingLoading] = useState(false);

  // Reset saved state when pit changes
  useEffect(() => {
    if (!pit || !loggedIn) { setSaved(false); return; }
    fetch(`/api/saved-pits`)
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

  if (!pit) return null;

  const typeLabel =
    pit.pitType === "WASTE" ? "Waste Pit" :
    pit.pitType === "BORROW" ? "Borrow Pit" : "Waste & Borrow";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 md:hidden"
        onClick={onClose}
      />
      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white rounded-t-2xl shadow-2xl p-5 pb-8 space-y-4 animate-slide-up">
        {/* Handle */}
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto" />

        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-gray-900 text-lg leading-tight">{pit.name}</h2>
            {pit.address && (
              <p className="text-sm text-gray-500 mt-0.5">{pit.address}, {pit.state}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl shrink-0">✕</button>
        </div>

        <div className="flex gap-2 flex-wrap">
          <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{typeLabel}</span>
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
            pit.accepting ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          }`}>
            {pit.accepting ? "● Open" : "● Closed"}
          </span>
        </div>

        <div className="space-y-1 text-sm text-gray-700">
          {pit.dumpRateCents && (
            <div className="flex justify-between">
              <span className="text-gray-500">Dump rate</span>
              <span className="font-semibold">${(pit.dumpRateCents / 100).toFixed(2)}/load</span>
            </div>
          )}
          {pit.borrowRateCents && (
            <div className="flex justify-between">
              <span className="text-gray-500">Borrow rate</span>
              <span className="font-semibold">${(pit.borrowRateCents / 100).toFixed(2)}/load</span>
            </div>
          )}
          {pit.hasTopsoil && pit.topsoilRateCents && (
            <div className="flex justify-between">
              <span className="text-gray-500">Topsoil</span>
              <span className="font-semibold">${(pit.topsoilRateCents / 100).toFixed(2)}/load</span>
            </div>
          )}
          {!pit.dumpRateCents && !pit.borrowRateCents && (
            <p className="text-gray-400 text-xs">No rates listed</p>
          )}
        </div>

        <div className="flex gap-3">
          <Link
            href={`/pit/${pit.id}`}
            className="flex-1 text-center bg-green-700 text-white py-3 rounded-xl font-semibold text-sm hover:bg-green-800"
          >
            View Details →
          </Link>
          {loggedIn && (
            <button
              onClick={toggleSave}
              disabled={savingLoading}
              className={`px-4 py-3 rounded-xl border text-sm font-medium transition-colors disabled:opacity-50 ${
                saved
                  ? "bg-amber-50 border-amber-300 text-amber-700"
                  : "bg-white border-gray-200 text-gray-600"
              }`}
            >
              {saved ? "📌" : "🔖"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
