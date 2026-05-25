"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

interface UnclaimedPit {
  id: string;
  name: string;
  address: string | null;
  state: string;
  pitType: string;
  accepting: boolean;
  latitude: number;
  longitude: number;
  pitClaims?: Array<{ id: string; status: string }>;
  myClaimStatus?: string | null;
}

const GA_STATES = ["AL", "FL", "GA", "NC", "SC", "TN"];

function pitTypeLabel(t: string) {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Shared claim form ─────────────────────────────────────────────────────

function ClaimForm({
  pit,
  onSuccess,
  onCancel,
}: {
  pit: UnclaimedPit;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [message,    setMessage]    = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");

  async function submit() {
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/pit-claims", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ pitId: pit.id, message }),
    });
    if (res.ok) {
      onSuccess();
    } else {
      const d = await res.json();
      setError(d.error ?? "Failed to submit claim");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3 mt-4 pt-4 border-t border-gray-100">
      <p className="text-sm font-semibold text-gray-800">Claiming: {pit.name}</p>
      <label className="block text-sm text-gray-600">
        Help us verify ownership <span className="text-gray-400">(optional but speeds up review)</span>
      </label>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        placeholder="e.g. Phone on file: (555) 123-4567. Operating since 2018. Located off Hwy 19 at mile marker 12."
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button onClick={submit} disabled={submitting}
          className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50">
          {submitting ? "Submitting…" : "Submit Claim"}
        </button>
        <button onClick={onCancel}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Search mode ───────────────────────────────────────────────────────────

function SearchMode({ apiKey }: { apiKey: string }) {
  const [query,      setQuery]      = useState("");
  const [state,      setState]      = useState("");
  const [pits,       setPits]       = useState<UnclaimedPit[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [successIds, setSuccessIds] = useState<Set<string>>(new Set());

  const fetchPits = useCallback(async (q: string, st: string) => {
    setLoading(true);
    setHasSearched(true);
    const params = new URLSearchParams();
    if (q)  params.set("search", q);
    if (st) params.set("state",  st);

    // Detect coordinate input: "33.7, -84.3" or "33.7 -84.3"
    const coordMatch = q.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
    if (coordMatch) {
      params.delete("search");
      params.set("nearLat", coordMatch[1]);
      params.set("nearLng", coordMatch[2]);
    }

    const res  = await fetch(`/api/pit-claims?${params}`);
    const data = await res.json();
    setPits(data.pits ?? []);
    setLoading(false);
  }, []);

  // Trigger search on state change immediately; debounce query typing
  useEffect(() => {
    if (!query && !state) { setPits([]); setHasSearched(false); return; }
    const t = setTimeout(() => fetchPits(query, state), 300);
    return () => clearTimeout(t);
  }, [query, state, fetchPits]);

  function useMyLocation() {
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      setQuery(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
    });
  }

  // suppress unused apiKey warning — it's passed for map mode sibling
  void apiKey;

  return (
    <div className="space-y-4">
      {/* Inputs */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, address, zip code, or coordinates (lat, lng)…"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <button
            type="button"
            onClick={useMyLocation}
            title="Use my location"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-amber-600 transition-colors"
          >
            📍
          </button>
        </div>
        <select
          value={state}
          onChange={(e) => setState(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <option value="">All states</option>
          {GA_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <p className="text-xs text-gray-400">
        Search by pit name, address, zip code, or paste coordinates (e.g. 33.749, -84.388). 📍 uses your GPS.
      </p>

      {loading && (
        <div className="text-center py-10 text-gray-400 text-sm animate-pulse">Searching…</div>
      )}

      {!loading && hasSearched && pits.length === 0 && (
        <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-gray-200">
          <p className="font-semibold text-gray-600 mb-1">No unclaimed pits found</p>
          <p className="text-sm">Try a different search, switch to Map view to browse, or contact us to add your pit.</p>
        </div>
      )}

      {!loading && !hasSearched && (
        <div className="text-center py-12 text-gray-300">
          <p className="text-sm">Type a name, address, or coordinates to find your pit.</p>
        </div>
      )}

      {!loading && pits.map((pit) => {
        const myClaim = pit.pitClaims?.[0];
        const claimed = !!myClaim;
        const isSuccess = successIds.has(pit.id);

        return (
          <div key={pit.id} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">{pit.name}</p>
                {pit.address && (
                  <p className="text-sm text-gray-500 mt-0.5">{pit.address}, {pit.state}</p>
                )}
                <div className="flex gap-2 mt-2 flex-wrap">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {pitTypeLabel(pit.pitType)}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pit.accepting ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {pit.accepting ? "Accepting" : "Not accepting"}
                  </span>
                  <span className="text-xs text-gray-400">
                    {pit.latitude.toFixed(4)}, {pit.longitude.toFixed(4)}
                  </span>
                </div>
              </div>
              <div className="shrink-0">
                {isSuccess || myClaim?.status === "PENDING" ? (
                  <span className="text-xs bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full font-medium">Claim pending</span>
                ) : myClaim?.status === "APPROVED" ? (
                  <span className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-full font-medium">✓ Approved</span>
                ) : myClaim?.status === "REJECTED" ? (
                  <span className="text-xs bg-red-100 text-red-600 px-3 py-1.5 rounded-full font-medium">Rejected</span>
                ) : !claimed && claimingId !== pit.id ? (
                  <button onClick={() => setClaimingId(pit.id)}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium">
                    Claim This Pit
                  </button>
                ) : null}
              </div>
            </div>

            {claimingId === pit.id && (
              <ClaimForm
                pit={pit}
                onSuccess={() => {
                  setSuccessIds((s) => { const n = new Set(s); n.add(pit.id); return n; });
                  setClaimingId(null);
                }}
                onCancel={() => setClaimingId(null)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Map mode ──────────────────────────────────────────────────────────────

function MapMode({ apiKey }: { apiKey: string }) {
  const mapRef       = useRef<HTMLDivElement>(null);
  const mapInstance  = useRef<google.maps.Map | null>(null);
  const markersRef   = useRef<Map<string, google.maps.Marker>>(new Map());
  const infoWinRef   = useRef<google.maps.InfoWindow | null>(null);
  const [pits,       setPits]       = useState<UnclaimedPit[]>([]);
  const [selected,   setSelected]   = useState<UnclaimedPit | null>(null);
  const [successIds, setSuccessIds] = useState<Set<string>>(new Set());
  const [mapReady,   setMapReady]   = useState(false);
  const [error,      setError]      = useState("");

  // Fetch all unclaimed pits for the map
  useEffect(() => {
    fetch("/api/pit-claims?forMap=true")
      .then((r) => r.json())
      .then((d) => setPits(d.pits ?? []))
      .catch(() => setError("Failed to load pits"));
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    if (!apiKey) { setError("Google Maps API key not configured."); return; }

    (async () => {
      setOptions({ key: apiKey, v: "weekly" });
      const { Map } = await importLibrary("maps") as google.maps.MapsLibrary;
      mapInstance.current = new Map(mapRef.current!, {
        center:    { lat: 32.8, lng: -83.6 },
        zoom:      7,
        mapTypeId: "hybrid",
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        fullscreenControl: true,
      });
      setMapReady(true);
    })();
  }, [apiKey]);

  // Add / update markers whenever pits or map change
  useEffect(() => {
    if (!mapReady || !mapInstance.current) return;

    const map = mapInstance.current;
    const kept = new Set<string>();

    pits.forEach((pit) => {
      if (successIds.has(pit.id)) return; // hide claimed pits
      kept.add(pit.id);

      if (markersRef.current.has(pit.id)) return; // already placed

      const marker = new google.maps.Marker({
        map,
        position: { lat: pit.latitude, lng: pit.longitude },
        title:    pit.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: pit.myClaimStatus === "PENDING" ? "#f59e0b"
            : pit.myClaimStatus === "APPROVED"       ? "#16a34a"
            : "#ea580c",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
      });

      marker.addListener("click", () => {
        setSelected(pit);
        map.panTo({ lat: pit.latitude, lng: pit.longitude });
      });

      markersRef.current.set(pit.id, marker);
    });

    // Remove markers for pits no longer in list
    markersRef.current.forEach((marker, id) => {
      if (!kept.has(id)) {
        marker.setMap(null);
        markersRef.current.delete(id);
      }
    });
  }, [pits, mapReady, successIds]);

  // Close info window ref (unused but needed for cleanup)
  void infoWinRef;

  if (error) {
    return <div className="bg-red-50 text-red-700 rounded-xl p-4 text-sm">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-orange-600 inline-block" /> Unclaimed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" /> Pending claim
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-green-600 inline-block" /> Approved
        </span>
        <span className="ml-auto text-gray-400">{pits.length} unclaimed pit{pits.length !== 1 ? "s" : ""} shown</span>
      </div>

      {/* Map */}
      <div ref={mapRef} className="w-full rounded-2xl overflow-hidden border border-gray-200"
        style={{ height: 420 }} />

      {/* Selected pit panel */}
      {selected && !successIds.has(selected.id) && (
        <div className="bg-white rounded-2xl border border-amber-300 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-bold text-gray-900 text-lg">{selected.name}</p>
              {selected.address && (
                <p className="text-sm text-gray-500 mt-0.5">{selected.address}, {selected.state}</p>
              )}
              <div className="flex gap-2 mt-2 flex-wrap">
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {pitTypeLabel(selected.pitType)}
                </span>
                <span className="text-xs text-gray-400">
                  {selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)}
                </span>
              </div>
            </div>
            <button onClick={() => setSelected(null)}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none shrink-0">×</button>
          </div>

          {selected.myClaimStatus === "PENDING" ? (
            <p className="mt-4 text-sm text-amber-700 font-medium">You have a pending claim on this pit.</p>
          ) : selected.myClaimStatus === "APPROVED" ? (
            <p className="mt-4 text-sm text-green-700 font-medium">✓ Your claim on this pit was approved.</p>
          ) : (
            <ClaimForm
              pit={selected}
              onSuccess={() => {
                setSuccessIds((s) => { const n = new Set(s); n.add(selected.id); return n; });
                setSelected(null);
                // Update marker color
                const m = markersRef.current.get(selected.id);
                if (m) m.setIcon({
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 9,
                  fillColor: "#f59e0b",
                  fillOpacity: 1,
                  strokeColor: "#fff",
                  strokeWeight: 2,
                });
              }}
              onCancel={() => setSelected(null)}
            />
          )}
        </div>
      )}

      {!selected && (
        <p className="text-sm text-center text-gray-400">Click a marker on the map to select a pit and claim it.</p>
      )}
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────

export default function ClaimPitList({ apiKey }: { apiKey: string }) {
  const [mode, setMode] = useState<"search" | "map">("search");

  return (
    <div className="space-y-5">
      {/* Mode switcher */}
      <div className="flex rounded-xl border border-gray-200 overflow-hidden w-fit">
        {(["search", "map"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-6 py-2 text-sm font-semibold transition-colors
              ${mode === m ? "bg-amber-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            {m === "search" ? "🔍 Search" : "🗺️ Map"}
          </button>
        ))}
      </div>

      {mode === "search" ? (
        <SearchMode apiKey={apiKey} />
      ) : (
        <MapMode apiKey={apiKey} />
      )}
    </div>
  );
}
