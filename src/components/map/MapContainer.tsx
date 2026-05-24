"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { PitSummary } from "@/types";
import { SearchPanel } from "./SearchPanel";
import PitModal from "./PitModal";

interface LiveDriver {
  id: string;
  currentLat: number;
  currentLng: number;
  truckType: string | null;
  lastLocationAt: string | null;
  user: { name: string | null };
}

interface CarrierTerminal {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  carrier: { id: string; companyName: string | null; user: { name: string | null } };
}

const ATLANTA = { lat: 33.749, lng: -84.388 };

interface Props {
  apiKey: string;
  loggedIn?: boolean;
}

export function MapContainer({ apiKey, loggedIn = false }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markerMapRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const driverMarkerMapRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const terminalMarkerMapRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchBoundsRef = useRef<(ne: google.maps.LatLng, sw: google.maps.LatLng) => void>(() => {});
  const [pits, setPits] = useState<PitSummary[]>([]);
  const [liveDrivers, setLiveDrivers] = useState<LiveDriver[]>([]);
  const [terminals, setTerminals] = useState<CarrierTerminal[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [radiusMiles, setRadiusMiles] = useState(50);
  const [filterType, setFilterType] = useState<string>("");
  const [filterAccepting, setFilterAccepting] = useState<string>("");
  const [filterMaterial, setFilterMaterial] = useState<string>("");
  const [filterOperatorEquipment, setFilterOperatorEquipment] = useState(false);
  const [filterState, setFilterState] = useState("");

  const fetchBounds = useCallback(async (ne: google.maps.LatLng, sw: google.maps.LatLng) => {
    setLoading(true);
    try {
      const boundsParams = {
        ne_lat: String(ne.lat()), ne_lng: String(ne.lng()),
        sw_lat: String(sw.lat()), sw_lng: String(sw.lng()),
      };
      const pitParams = new URLSearchParams({
        ...boundsParams,
        ...(filterType ? { type: filterType } : {}),
        ...(filterAccepting ? { accepting: filterAccepting } : {}),
        ...(filterMaterial ? { material: filterMaterial } : {}),
        ...(filterOperatorEquipment ? { operatorProvided: "true", equipmentProvided: "true" } : {}),
        ...(filterState ? { state: filterState } : {}),
      });
      const fetches: Promise<void>[] = [
        fetch(`/api/pits?${pitParams}`).then((r) => r.json()).then((d) => setPits(d.pits ?? [])),
      ];
      if (loggedIn) {
        const bq = new URLSearchParams(boundsParams);
        fetches.push(
          fetch(`/api/carriers/terminals?${bq}`).then((r) => r.json()).then((d) => setTerminals(d.terminals ?? [])),
          // drivers: use center point + 100mi radius
          fetch(`/api/drivers/nearby?lat=${(ne.lat() + sw.lat()) / 2}&lng=${(ne.lng() + sw.lng()) / 2}&radius=100`)
            .then((r) => r.json()).then((d) => setLiveDrivers(d.drivers ?? [])),
        );
      }
      await Promise.all(fetches);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterAccepting, filterMaterial, filterOperatorEquipment, filterState, loggedIn]);

  useEffect(() => { fetchBoundsRef.current = fetchBounds; }, [fetchBounds]);

  // Re-fetch when filters change using current viewport
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    const bounds = map.getBounds();
    if (!bounds) return;
    fetchBoundsRef.current(bounds.getNorthEast(), bounds.getSouthWest());
  }, [filterType, filterAccepting, filterMaterial, filterOperatorEquipment, filterState]);

  // Initialize Google Maps
  useEffect(() => {
    if (!mapRef.current || mapInstance.current || !apiKey) return;

    setOptions({ key: apiKey, v: "weekly" });

    (async () => {
      await importLibrary("maps");
      await importLibrary("marker");
      await importLibrary("geocoding");
      const map = new google.maps.Map(mapRef.current!, {
        center: ATLANTA,
        zoom: 8,
        mapTypeId: google.maps.MapTypeId.HYBRID,
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
      });

      mapInstance.current = map;

      // Fetch whenever the viewport changes — debounced so it doesn't fire on every pixel
      map.addListener("bounds_changed", () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          const bounds = map.getBounds();
          if (!bounds) return;
          fetchBoundsRef.current(bounds.getNorthEast(), bounds.getSouthWest());
        }, 350);
      });
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // Incrementally sync markers — add new pits, remove ones no longer in results
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    // Initialize clusterer once
    if (!clustererRef.current) {
      clustererRef.current = new MarkerClusterer({ map, markers: [] });
    }

    const incomingIds = new Set(pits.map((p) => p.id));
    const toAdd: google.maps.Marker[] = [];
    const toRemove: google.maps.Marker[] = [];

    // Remove markers no longer in results
    markerMapRef.current.forEach((marker, id) => {
      if (!incomingIds.has(id)) {
        toRemove.push(marker);
        markerMapRef.current.delete(id);
      }
    });

    // Add markers for newly visible pits
    pits.forEach((pit, index) => {
      if (markerMapRef.current.has(pit.id)) return;

      const iconUrl = pit.accepting
        ? "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(pinSvg("green"))
        : "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(pinSvg("red"));

      const marker = new google.maps.Marker({
        position: { lat: pit.latitude, lng: pit.longitude },
        title: pit.name,
        icon: {
          url: iconUrl,
          scaledSize: new google.maps.Size(32, 40),
          anchor: new google.maps.Point(16, 40),
        },
      });

      marker.addListener("click", () => setSelectedIndex(index));
      markerMapRef.current.set(pit.id, marker);
      toAdd.push(marker);
    });

    if (toRemove.length) clustererRef.current.removeMarkers(toRemove);
    if (toAdd.length) clustererRef.current.addMarkers(toAdd);
  }, [pits]);

  // Live driver markers
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    if (!infoWindowRef.current) infoWindowRef.current = new google.maps.InfoWindow();

    const incomingIds = new Set(liveDrivers.map((d) => d.id));
    driverMarkerMapRef.current.forEach((marker, id) => {
      if (!incomingIds.has(id)) { marker.setMap(null); driverMarkerMapRef.current.delete(id); }
    });
    liveDrivers.forEach((driver) => {
      if (driverMarkerMapRef.current.has(driver.id)) return;
      if (driver.currentLat == null || driver.currentLng == null) return;
      const marker = new google.maps.Marker({
        position: { lat: driver.currentLat, lng: driver.currentLng },
        map,
        title: driver.user.name ?? "Driver",
        icon: {
          url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(truckSvg()),
          scaledSize: new google.maps.Size(36, 36),
          anchor: new google.maps.Point(18, 18),
        },
        zIndex: 10,
      });
      marker.addListener("click", () => {
        infoWindowRef.current?.setContent(
          `<div style="font-family:sans-serif;font-size:13px;padding:4px 2px;min-width:140px">
            <b>${driver.user.name ?? "Driver"}</b><br/>
            ${driver.truckType ?? "Truck Driver"}<br/>
            <span style="color:#6b7280;font-size:11px">Live · tap to book</span><br/>
            <a href="/dashboard/buyer/haul-orders/new" style="color:#d97706;font-size:12px;font-weight:600">Schedule Haul →</a>
          </div>`
        );
        infoWindowRef.current?.open(map, marker);
      });
      driverMarkerMapRef.current.set(driver.id, marker);
    });
  }, [liveDrivers]);

  // Carrier terminal markers
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    if (!infoWindowRef.current) infoWindowRef.current = new google.maps.InfoWindow();

    const incomingIds = new Set(terminals.map((t) => t.id));
    terminalMarkerMapRef.current.forEach((marker, id) => {
      if (!incomingIds.has(id)) { marker.setMap(null); terminalMarkerMapRef.current.delete(id); }
    });
    terminals.forEach((terminal) => {
      if (terminalMarkerMapRef.current.has(terminal.id)) return;
      const marker = new google.maps.Marker({
        position: { lat: terminal.lat, lng: terminal.lng },
        map,
        title: terminal.name,
        icon: {
          url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(terminalSvg()),
          scaledSize: new google.maps.Size(34, 34),
          anchor: new google.maps.Point(17, 17),
        },
        zIndex: 8,
      });
      const carrierName = terminal.carrier.companyName ?? terminal.carrier.user.name ?? "Carrier";
      marker.addListener("click", () => {
        infoWindowRef.current?.setContent(
          `<div style="font-family:sans-serif;font-size:13px;padding:4px 2px;min-width:140px">
            <b>${terminal.name}</b><br/>
            <span style="color:#6b7280">${carrierName}</span><br/>
            ${terminal.address ? `<span style="color:#9ca3af;font-size:11px">${terminal.address}</span><br/>` : ""}
            <a href="/dashboard/buyer/haul-orders/new" style="color:#d97706;font-size:12px;font-weight:600">Request Haul →</a>
          </div>`
        );
        infoWindowRef.current?.open(map, marker);
      });
      terminalMarkerMapRef.current.set(terminal.id, marker);
    });
  }, [terminals]);

  async function handleLocationSearch(query: string): Promise<boolean> {
    if (!mapInstance.current) return false;
    try {
      const geocoder = new google.maps.Geocoder();
      const result = await geocoder.geocode({
        address: query,
        componentRestrictions: { country: "us" },
      });
      if (!result.results[0]) return false;
      mapInstance.current.setCenter(result.results[0].geometry.location);
      mapInstance.current.setZoom(11);
      return true;
    } catch {
      return false;
    }
  }

  function geolocate() {
    if (!mapInstance.current) return;
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const pos = { lat: coords.latitude, lng: coords.longitude };
      mapInstance.current!.setCenter(pos);
      mapInstance.current!.setZoom(11);
    });
  }

  if (!apiKey) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <p className="text-red-600 font-medium">Google Maps API key is not configured. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in Vercel and redeploy.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />

      <SearchPanel
        radiusMiles={radiusMiles}
        onRadiusChange={setRadiusMiles}
        filterType={filterType}
        onFilterTypeChange={setFilterType}
        filterAccepting={filterAccepting}
        onFilterAcceptingChange={setFilterAccepting}
        filterMaterial={filterMaterial}
        onFilterMaterialChange={setFilterMaterial}
        filterOperatorEquipment={filterOperatorEquipment}
        onFilterOperatorEquipmentChange={setFilterOperatorEquipment}
        filterState={filterState}
        onFilterStateChange={setFilterState}
        onGeolocate={geolocate}
        onLocationSearch={handleLocationSearch}
        loading={loading}
        pitCount={pits.length}
      />

      <PitModal
        pits={pits}
        selectedIndex={selectedIndex}
        onClose={() => setSelectedIndex(null)}
        onNavigate={setSelectedIndex}
        loggedIn={loggedIn}
      />

      {/* Map legend — only shown when logged in and overlays are active */}
      {loggedIn && (liveDrivers.length > 0 || terminals.length > 0) && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg px-4 py-2 flex items-center gap-4 text-xs font-medium text-gray-600 pointer-events-none z-10">
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-green-600 inline-block" /> Pit (open)</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-red-600 inline-block" /> Pit (closed)</span>
          {liveDrivers.length > 0 && <span className="flex items-center gap-1.5">🚛 Driver ({liveDrivers.length})</span>}
          {terminals.length > 0 && <span className="flex items-center gap-1.5">🏢 Terminal ({terminals.length})</span>}
        </div>
      )}
    </div>
  );
}

function pinSvg(color: "green" | "red") {
  const fill = color === "green" ? "#16a34a" : "#dc2626";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
    <path d="M16 0C9.37 0 4 5.37 4 12c0 9 12 28 12 28s12-19 12-28c0-6.63-5.37-12-12-12z" fill="${fill}"/>
    <circle cx="16" cy="12" r="5" fill="white"/>
  </svg>`;
}

function truckSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
    <circle cx="18" cy="18" r="18" fill="#f59e0b"/>
    <text x="18" y="23" text-anchor="middle" font-size="18">🚛</text>
  </svg>`;
}

function terminalSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
    <circle cx="17" cy="17" r="17" fill="#3b82f6"/>
    <text x="17" y="22" text-anchor="middle" font-size="16">🏢</text>
  </svg>`;
}
