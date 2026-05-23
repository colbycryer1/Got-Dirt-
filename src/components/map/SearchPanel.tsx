"use client";

interface Props {
  radiusMiles: number;
  onRadiusChange: (v: number) => void;
  filterType: string;
  onFilterTypeChange: (v: string) => void;
  filterAccepting: string;
  onFilterAcceptingChange: (v: string) => void;
  onGeolocate: () => void;
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
  onGeolocate,
  loading,
  pitCount,
}: Props) {
  return (
    <div className="absolute top-3 left-3 z-10 bg-white rounded-2xl shadow-xl p-4 w-64 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-bold text-gray-900 text-sm">Got Dirt</span>
        <span className="text-xs text-gray-400">
          {loading ? "Loading…" : `${pitCount} pit${pitCount !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Geolocate */}
      <button
        onClick={onGeolocate}
        className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          className="w-full accent-green-600"
        />
      </div>

      {/* Pit type filter */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Pit Type</label>
        <select
          value={filterType}
          onChange={(e) => onFilterTypeChange(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">All Types</option>
          <option value="WASTE">Waste Pit</option>
          <option value="BORROW">Borrow Pit</option>
          <option value="WASTE_BORROW">Waste & Borrow</option>
        </select>
      </div>

      {/* Accepting filter */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Availability</label>
        <select
          value={filterAccepting}
          onChange={(e) => onFilterAcceptingChange(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">All Pits</option>
          <option value="true">Accepting Only</option>
          <option value="false">Not Accepting</option>
        </select>
      </div>

      {/* Legend */}
      <div className="border-t border-gray-100 pt-2 flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-green-600 inline-block" />
          Accepting
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-red-600 inline-block" />
          Full
        </span>
      </div>
    </div>
  );
}
