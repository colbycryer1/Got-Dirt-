"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface ActiveOrder {
  id:             string;
  pitName:        string;
  pitState:       string;
  loads:          number;
  pitLat:         number | null;
  pitLng:         number | null;
  geofenceMeters: number;
}

interface Props {
  locationEnabled: boolean;
  activeOrders:    ActiveOrder[];
}

const SPEED_THRESHOLD_MS = 1.5;   // m/s — below this = stationary
const CONFIRM_TIMEOUT_MS = 5000;  // double-tap window in ms
const SESSION_POLL_MS    = 15000; // poll pit session every 15 s
const HEARTBEAT_MS       = 30000; // push GPS to server every 30 s

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R    = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function GpsLoadLogButton({ locationEnabled, activeOrders }: Props) {
  const [speed,          setSpeed]          = useState<number | null>(null);
  const [lat,            setLat]            = useState<number | null>(null);
  const [lng,            setLng]            = useState<number | null>(null);
  const [orderId,        setOrderId]        = useState(activeOrders[0]?.id ?? "");
  const [driverCount,    setDriverCount]    = useState<Record<string, number>>({});
  const [logging,        setLogging]        = useState(false);
  const [lastLogged,     setLastLogged]     = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const [sessionActive,  setSessionActive]  = useState(false);
  const [pitOwnerCount,  setPitOwnerCount]  = useState(0);

  const watchIdRef      = useRef<number | null>(null);
  const heartbeatRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionPollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Watch GPS position
  useEffect(() => {
    if (!locationEnabled || !navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setSpeed(pos.coords.speed);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    );
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [locationEnabled]);

  // Server heartbeat — push position every 30 s
  useEffect(() => {
    if (heartbeatRef.current !== null) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
    if (!locationEnabled || lat === null || lng === null) return;
    const push = () => fetch("/api/driver/location", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: true, lat, lng }),
    }).catch(() => {});
    push();
    heartbeatRef.current = setInterval(push, HEARTBEAT_MS);
    return () => { if (heartbeatRef.current !== null) clearInterval(heartbeatRef.current); };
  }, [locationEnabled, lat, lng]);

  // Poll pit session status + pit owner count
  const pollSession = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/haul-orders/${orderId}/pit-session`);
      if (res.ok) {
        const data = await res.json();
        setSessionActive(data.active ?? false);
        setPitOwnerCount(data.pitOwnerCount ?? 0);
      }
    } catch {}
  }, [orderId]);

  useEffect(() => {
    if (sessionPollRef.current !== null) { clearInterval(sessionPollRef.current); sessionPollRef.current = null; }
    if (!orderId) return;
    pollSession();
    sessionPollRef.current = setInterval(pollSession, SESSION_POLL_MS);
    return () => { if (sessionPollRef.current !== null) clearInterval(sessionPollRef.current); };
  }, [orderId, pollSession]);

  // Load initial driver counts
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

  // Derived state
  const selectedOrder = activeOrders.find((o) => o.id === orderId);
  const isStationary  = speed === null || speed < SPEED_THRESHOLD_MS;

  const distanceToPit = (lat !== null && lng !== null && selectedOrder?.pitLat && selectedOrder?.pitLng)
    ? haversineMeters(lat, lng, selectedOrder.pitLat, selectedOrder.pitLng)
    : null;
  const withinGeofence = distanceToPit !== null && distanceToPit <= (selectedOrder?.geofenceMeters ?? 200);

  const canLog = locationEnabled && isStationary && withinGeofence && sessionActive && !!orderId;
  const myCount = orderId ? (driverCount[orderId] ?? 0) : 0;

  function gateMessage(): string {
    if (!locationEnabled)   return "Enable live location above to unlock";
    if (!withinGeofence)    return distanceToPit !== null
      ? `${Math.round(distanceToPit)}m from pit — drive to the pit to unlock`
      : "Acquiring GPS position…";
    if (!sessionActive)     return "Waiting for pit operator to start your load session";
    if (!isStationary)      return "Moving — stop the truck to log a load";
    return "Ready — tap twice to confirm each load";
  }

  async function handleLogTap() {
    if (!canLog || logging) return;

    if (!pendingConfirm) {
      setPendingConfirm(true);
      confirmTimerRef.current = setTimeout(() => setPendingConfirm(false), CONFIRM_TIMEOUT_MS);
      return;
    }

    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setPendingConfirm(false);
    setLogging(true);
    try {
      const res = await fetch("/api/driver/load-log", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ haulOrderId: orderId, lat, lng, speed }),
      });
      if (res.ok) {
        const { count } = await res.json();
        setDriverCount((prev) => ({ ...prev, [orderId]: count }));
        setLastLogged(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
        pollSession();
      }
    } catch {}
    setLogging(false);
  }

  if (activeOrders.length === 0) return null;

  return (
    <div className={`rounded-2xl border p-5 space-y-4 transition-all ${
      canLog ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white"
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900">GPS Load Log</p>
          <p className="text-xs text-gray-500 mt-0.5">{gateMessage()}</p>
        </div>
        <div className="text-right shrink-0 space-y-1">
          <div>
            <p className="text-2xl font-black text-gray-900">{myCount}</p>
            <p className="text-xs text-gray-400">your log</p>
          </div>
          {pitOwnerCount > 0 && (
            <div>
              <p className="text-lg font-bold text-blue-700">{pitOwnerCount}</p>
              <p className="text-xs text-blue-500">pit log</p>
            </div>
          )}
        </div>
      </div>

      {activeOrders.length > 1 && (
        <select value={orderId} onChange={(e) => setOrderId(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {activeOrders.map((o) => (
            <option key={o.id} value={o.id}>{o.pitName}, {o.pitState} — {o.loads} est. loads</option>
          ))}
        </select>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold
          ${locationEnabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${locationEnabled ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
          {locationEnabled ? "GPS On" : "GPS Off"}
        </span>

        {locationEnabled && (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold
            ${withinGeofence ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
            {withinGeofence ? "At Pit" : distanceToPit !== null ? `${Math.round(distanceToPit)}m away` : "Locating…"}
          </span>
        )}

        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold
          ${sessionActive ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${sessionActive ? "bg-amber-500 animate-pulse" : "bg-gray-300"}`} />
          {sessionActive ? "Session Active" : "No Session"}
        </span>

        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold
          ${isStationary ? "bg-teal-100 text-teal-700" : "bg-amber-100 text-amber-700"}`}>
          {isStationary ? "Stopped" : speed !== null ? `${(speed * 2.237).toFixed(1)} mph` : "Moving"}
        </span>
      </div>

      {lastLogged && <p className="text-xs text-green-600 font-semibold">Last logged at {lastLogged}</p>}

      <button
        onClick={handleLogTap}
        disabled={!canLog || logging}
        className={`relative w-full rounded-xl font-bold text-sm transition-colors overflow-hidden
          ${pendingConfirm
            ? "bg-amber-500 text-white"
            : canLog
            ? "bg-blue-600 text-white hover:bg-blue-700"
            : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
        style={{ height: 52, touchAction: "manipulation" }}
      >
        {/* Fixed-size inner layers — text never reflowing keeps the button stable */}
        <span className={`absolute inset-0 flex items-center justify-center transition-opacity duration-150
          ${pendingConfirm || logging ? "opacity-0" : "opacity-100"}`}>
          Log Load
        </span>
        <span className={`absolute inset-0 flex items-center justify-center transition-opacity duration-150
          ${pendingConfirm && !logging ? "opacity-100" : "opacity-0"}`}>
          Tap again to confirm
        </span>
        <span className={`absolute inset-0 flex items-center justify-center transition-opacity duration-150
          ${logging ? "opacity-100" : "opacity-0"}`}>
          Logging…
        </span>
      </button>

      <p className="text-xs text-gray-400 text-center">
        Pit operator starts your session — double-tap confirms each load. Both logs shown for dispute resolution.
      </p>
    </div>
  );
}
