"use client";

import { useState, useEffect, useRef } from "react";

interface ActiveOrder {
  id:       string;
  pitName:  string;
  pitState: string;
  loads:    number; // estimated
}

interface Props {
  locationEnabled: boolean;
  activeOrders:    ActiveOrder[];
}

const SPEED_THRESHOLD_MS = 1.5; // m/s (~3.4 mph) — below this = stationary

export default function GpsLoadLogButton({ locationEnabled, activeOrders }: Props) {
  const [speed,         setSpeed]         = useState<number | null>(null);
  const [lat,           setLat]           = useState<number | null>(null);
  const [lng,           setLng]           = useState<number | null>(null);
  const [orderId,       setOrderId]       = useState(activeOrders[0]?.id ?? "");
  const [driverCount,   setDriverCount]   = useState<Record<string, number>>({});
  const [logging,       setLogging]       = useState(false);
  const [lastLogged,    setLastLogged]    = useState<string | null>(null);
  const watchIdRef    = useRef<number | null>(null);
  const heartbeatRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // Watch GPS position when location is enabled
  useEffect(() => {
    if (!locationEnabled || !navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setSpeed(pos.coords.speed); // null on some devices when stationary
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [locationEnabled]);

  // Server heartbeat — push location to /api/driver/location every 30 seconds
  useEffect(() => {
    if (heartbeatRef.current !== null) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }

    if (!locationEnabled || lat === null || lng === null) return;

    const push = () => {
      fetch("/api/driver/location", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ enabled: true, lat, lng }),
      }).catch(() => {});
    };

    // Push immediately, then every 30 seconds
    push();
    heartbeatRef.current = setInterval(push, 30_000);

    return () => {
      if (heartbeatRef.current !== null) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [locationEnabled, lat, lng]);

  // Load initial driver counts for each active order
  useEffect(() => {
    if (activeOrders.length === 0) return;
    activeOrders.forEach(async (o) => {
      try {
        const res = await fetch(`/api/driver/load-log?haulOrderId=${o.id}`);
        if (res.ok) {
          const { count } = await res.json();
          setDriverCount((prev) => ({ ...prev, [o.id]: count }));
        }
      } catch {}
    });
  }, [activeOrders]);

  const isStationary = speed === null || speed < SPEED_THRESHOLD_MS;
  const canLog       = locationEnabled && isStationary && !!orderId;

  async function logLoad() {
    if (!canLog || logging) return;
    setLogging(true);
    try {
      const res = await fetch("/api/driver/load-log", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ haulOrderId: orderId, lat, lng, speed }),
      });
      if (res.ok) {
        const { count } = await res.json();
        setDriverCount((prev) => ({ ...prev, [orderId]: count }));
        setLastLogged(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
      }
    } catch {}
    setLogging(false);
  }

  if (activeOrders.length === 0) return null;

  const selectedOrder = activeOrders.find((o) => o.id === orderId);
  const myCount       = orderId ? (driverCount[orderId] ?? 0) : 0;

  return (
    <div className={`rounded-2xl border p-5 space-y-4 ${canLog ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-white"}`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900">GPS Load Log</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {!locationEnabled
              ? "Enable live location above to unlock"
              : !isStationary
              ? "Moving — stop the truck to log a load"
              : "Stationary — ready to log"}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-black text-gray-900">{myCount}</p>
          <p className="text-xs text-gray-400">driver log</p>
        </div>
      </div>

      {/* Order selector when multiple active orders */}
      {activeOrders.length > 1 && (
        <select
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {activeOrders.map((o) => (
            <option key={o.id} value={o.id}>
              {o.pitName}, {o.pitState} — {o.loads} est. loads
            </option>
          ))}
        </select>
      )}

      {/* Status indicators */}
      <div className="flex items-center gap-2 text-xs">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold
          ${locationEnabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${locationEnabled ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
          {locationEnabled ? "GPS On" : "GPS Off"}
        </span>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold
          ${isStationary ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
          {isStationary ? "Stationary" : `Moving ${speed !== null ? `(${(speed * 2.237).toFixed(1)} mph)` : ""}`}
        </span>
      </div>

      {selectedOrder && (
        <p className="text-xs text-gray-500">
          Pit: {selectedOrder.pitName}, {selectedOrder.pitState}
        </p>
      )}

      {lastLogged && (
        <p className="text-xs text-green-600 font-semibold">Last logged at {lastLogged}</p>
      )}

      <button
        onClick={logLoad}
        disabled={!canLog || logging}
        className={`w-full py-3 rounded-xl font-bold text-sm transition-colors
          ${canLog
            ? "bg-blue-600 text-white hover:bg-blue-700 active:scale-95"
            : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
      >
        {logging ? "Logging…" : "Log Load"}
      </button>

      <p className="text-xs text-gray-400 text-center">
        Your log is separate from the pit operator&apos;s log — both counts are shown to resolve disputes.
      </p>
    </div>
  );
}
