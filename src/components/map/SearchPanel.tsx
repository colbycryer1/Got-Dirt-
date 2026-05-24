"use client";

import { useState, FormEvent } from "react";
import { MATERIAL_TYPES_BASE, MATERIAL_TYPES_AGGREGATE } from "@/types";

interface Props {
  radiusMiles: number;
  onRadiusChange: (v: number) => void;
  filterType: string;
  onFilterTypeChange: (v: string) => void;
  filterAccepting: string;
  onFilterAcceptingChange: (v: string) => void;
  filterMaterial: string;
  onFilterMaterialChange: (v: string) => void;
  filterOperatorEquipment: boolean;
  onFilterOperatorEquipmentChange: (v: boolean) => void;
  filterState: string;
  onFilterStateChange: (v: string) => void;
  onGeolocate: () => void;
  onLocationSearch: (query: string) => Promise<boolean>;
  loading: boolean;
  pitCount: number;
}

export function SearchPanel({
  radiusMiles,
  onRadiusChange,
  filterType,
  onFilterTypeChange,
  filterAccepting,
  onFilterAcceptingChange,
  filterMaterial,
  onFilterMaterialChange,
  filterOperatorEquipment,
  onFilterOperatorEquipmentChange,
  filterState,
  onFilterStateChange,
  onGeolocate,
  onLocationSearch,
  loading,
  pitCount,
}: Props) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [minimized, setMinimized] = useState(false);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setNotFound(false);
    try {
      const found = await onLocationSearch(query.trim());
      setNotFound(!found);
    } catch {
      setNotFound(true);
    } finally {
      setSearching(false);
    }
  }

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="absolute top-3 left-3 z-10 bg-white rounded-2xl shadow-xl px-4 py-2.5 flex items-center gap-2 hover:bg-gray-50 transition-colors"
      >
        <span className="font-black text-black text-sm">Got Dirt?</span>
        <span className="text-xs text-gray-400">
          {loading ? "…" : `${pitCount} pit${pitCount !== 1 ? "s" : ""}`}
        </span>
        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    );
  }

  return (
    <div className="absolute top-3 left-3 z-10 bg-white rounded-2xl shadow-xl p-4 w-64 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-black text-black text-sm">Got Dirt?</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {loading ? "Loading…" : `${pitCount} pit${pitCount !== 1 ? "s" : ""}`}
          </span>
          <button
            onClick={() => setMinimized(true)}
            title="Minimize"
            className="text-gray-300 hover:text-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* City / ZIP search */}
      <form onSubmit={handleSearch} className="flex gap-1.5">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setNotFound(false); }}
          placeholder="City or ZIP code…"
          className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <button
          type="submit"
          disabled={searching}
          className="bg-amber-600 text-white px-3 py-2 rounded-xl hover:bg-amber-700 disabled:opacity-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
        </button>
      </form>
      {notFound && <p className="text-xs text-red-500 -mt-1">Location not found</p>}

      {/* Geolocate */}
      <button
        onClick={onGeolocate}
        className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3" strokeWidth="2"/>
          <path strokeWidth="2" d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
        </svg>
        Find Pits Near Me
      </button>

      {/* Radius */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Radius</span>
          <span className="font-medium text-gray-900">{radiusMiles} mi</span>
        </div>
        <input
          type="range"
          min={1}
          max={100}
          value={radiusMiles}
          onChange={(e) => onRadiusChange(Number(e.target.value))}
          className="w-full accent-amber-600"
        />
      </div>

      {/* Pit type filter */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Pit Type</label>
        <select
          value={filterType}
          onChange={(e) => onFilterTypeChange(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <option value="">All Types</option>
          <option value="WASTE">Waste Pit</option>
          <option value="BORROW">Borrow Pit</option>
          <option value="WASTE_BORROW">Waste &amp; Borrow</option>
        </select>
      </div>

      {/* Material Type filter */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Material Type</label>
        <select
          value={filterMaterial}
          onChange={(e) => onFilterMaterialChange(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <option value="">All Materials</option>
          {MATERIAL_TYPES_BASE.map((m) => <option key={m} value={m}>{m}</option>)}
          <optgroup label="Aggregate">
            {MATERIAL_TYPES_AGGREGATE.map((m) => <option key={m} value={m}>{m}</option>)}
          </optgroup>
        </select>
      </div>

      {/* Availability filter */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Availability</label>
        <select
          value={filterAccepting}
          onChange={(e) => onFilterAcceptingChange(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <option value="">All Pits</option>
          <option value="true">Open Only</option>
          <option value="false">Closed</option>
        </select>
      </div>

      {/* State filter */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">State</label>
        <select
          value={filterState}
          onChange={(e) => onFilterStateChange(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <option value="">All States</option>
          {US_STATES.map(([abbr, name]) => (
            <option key={abbr} value={abbr}>{name}</option>
          ))}
        </select>
      </div>

      {/* Operator & Equipment combined checkbox */}
      <div>
        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={filterOperatorEquipment}
            onChange={(e) => onFilterOperatorEquipmentChange(e.target.checked)}
            className="w-3.5 h-3.5 accent-amber-600"
          />
          Operator &amp; Equipment Provided
        </label>
      </div>

      {/* Legend */}
      <div className="border-t border-gray-100 pt-2 flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-green-600 inline-block" />
          Open
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-red-600 inline-block" />
          Closed
        </span>
      </div>
    </div>
  );
}

const US_STATES: [string, string][] = [
  ["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],
  ["CA","California"],["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],
  ["FL","Florida"],["GA","Georgia"],["HI","Hawaii"],["ID","Idaho"],
  ["IL","Illinois"],["IN","Indiana"],["IA","Iowa"],["KS","Kansas"],
  ["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],["MD","Maryland"],
  ["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],
  ["MO","Missouri"],["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],
  ["NH","New Hampshire"],["NJ","New Jersey"],["NM","New Mexico"],["NY","New York"],
  ["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],["OK","Oklahoma"],
  ["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],
  ["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],["UT","Utah"],
  ["VT","Vermont"],["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],
  ["WI","Wisconsin"],["WY","Wyoming"],
];
