"use client";

import { useEffect, useRef } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

interface Pit {
  id:                  string;
  name:                string;
  latitude:            number;
  longitude:           number;
  geofenceRadiusMeters: number;
}

interface Props {
  pits:   Pit[];
  apiKey: string;
}

export default function GeofenceMapClient({ pits, apiKey }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapRef.current || pits.length === 0) return;

    let cancelled = false;

    async function init() {
      setOptions({ key: apiKey, v: "weekly" });
      await importLibrary("maps");
      if (cancelled || !mapRef.current) return;

      const center = { lat: pits[0].latitude, lng: pits[0].longitude };

      const map = new google.maps.Map(mapRef.current, {
        center,
        zoom:      15,
        mapTypeId: google.maps.MapTypeId.HYBRID,
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      });

      for (const pit of pits) {
        // Pin marker
        new google.maps.Marker({
          position: { lat: pit.latitude, lng: pit.longitude },
          map,
          title: pit.name,
        });

        // Geofence circle
        new google.maps.Circle({
          map,
          center:      { lat: pit.latitude, lng: pit.longitude },
          radius:      pit.geofenceRadiusMeters,
          strokeColor: "#f59e0b",
          strokeOpacity: 0.9,
          strokeWeight: 2,
          fillColor:   "#f59e0b",
          fillOpacity: 0.12,
        });
      }

      // Fit bounds to show all pits if more than one
      if (pits.length > 1) {
        const bounds = new google.maps.LatLngBounds();
        for (const pit of pits) bounds.extend({ lat: pit.latitude, lng: pit.longitude });
        map.fitBounds(bounds, 80);
      }
    }

    init().catch(console.error);
    return () => { cancelled = true; };
  }, [pits, apiKey]);

  return <div ref={mapRef} className="w-full h-full" />;
}
