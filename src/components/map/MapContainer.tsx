"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { PitSummary } from "@/types";
import { SearchPanel } from "./SearchPanel";
import PitModal from "./PitModal";

const ATLANTA = { lat: 33.749, lng: -84.388 };

interface Props {
  apiKey: string;
  loggedIn?: boolean;
}

export function MapContainer({ apiKey, loggedIn = false }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const fetchPitsRef = useRef<(lat: number, lng: number) => void>(() => {});
  const [pits, setPits] = useState<PitSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [radiusMiles, setRadiusMiles] = useState(50);
  const [filterType, setFilterType] = useState<string>("");
  const [filterAccepting, setFilterAccepting] = useState<string>("");
  const [filterMaterial, setFilterMaterial] = useState<string>("");
  const [filterOperator, setFilterOperator] = useState(false);
  const [filterEquipment, setFilterEquipment] = useState(false);
  const [filterState, setFilterState] = useState("");

  const fetchPits = useCallback(async (lat: number, lng: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        lat: String(lat),
        lng: String(lng),
        radius: String(radiusMiles),
        ...(filterType ? { type: filterType } : {}),
        ...(filterAccepting ? { accepting: filterAccepting } : {}),
        ...(filterMaterial ? { material: filterMaterial } : {}),
        ...(filterOperator ? { operatorProvided: "true" } : {}),
        ...(filterEquipment ? { equipmentProvided: "true" } : {}),
        ...(filterState ? { state: filterState } : {}),
      });
      const res = await fetch(`/api/pits?${params}`);
      const data = await res.json();
      setPits(data.pits ?? []);
    } finally {
      setLoading(false);
    }
  }, [radiusMiles, filterType, filterAccepting, filterMaterial, filterOperator, filterEquipment, filterState]);

  useEffect(() => { fetchPitsRef.current = fetchPits; }, [fetchPits]);

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

      map.addListener("idle", () => {
        const center = map.getCenter();
        if (center) fetchPitsRef.current(center.lat(), center.lng());
      });
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // Sync markers + clusterer when pits change
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
      clustererRef.current.setMap(null);
      clustererRef.current = null;
    }
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const newMarkers: google.maps.Marker[] = [];

    pits.forEach((pit, index) => {
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

      newMarkers.push(marker);
    });

    markersRef.current = newMarkers;
    clustererRef.current = new MarkerClusterer({ map, markers: newMarkers });
  }, [pits]);

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
        filterOperator={filterOperator}
        onFilterOperatorChange={setFilterOperator}
        filterEquipment={filterEquipment}
        onFilterEquipmentChange={setFilterEquipment}
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
