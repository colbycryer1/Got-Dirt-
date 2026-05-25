"use client";

import { useState, useEffect, useRef } from "react";

interface Props {
  enabled: boolean;
  lat:     number | null;
  lng:     number | null;
}

function detectFirefox(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.userAgent.toLowerCase().includes("firefox");
}

function geoErrorMessage(err: GeolocationPositionError, isFirefox: boolean): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return isFirefox
        ? "Firefox blocked location access. To fix: click the lock icon (🔒) at the far left of the address bar → click the × next to Location → then tap Try Again below."
        : "Location access was denied. Click the lock icon in the address bar → Site settings → Allow Location → then tap Try Again.";
    case err.POSITION_UNAVAILABLE:
      return "Your location could not be determined. Make sure GPS or location services are enabled on this device.";
    case err.TIMEOUT:
      return isFirefox
        ? "Firefox timed out waiting for permission. Look for a location bar at the top of the browser and tap Allow, or tap Try Again."
        : "Location request timed out. Please try again.";
    default:
      return "Location access failed. Please check your browser permissions and try again.";
  }
}

export default function LocationToggle({ enabled: initialEnabled, lat: initialLat, lng: initialLng }: Props) {
  const [enabled,          setEnabled]          = useState(initialEnabled);
  const [saving,           setSaving]           = useState(false);
  const [error,            setError]            = useState("");
  const [lastLat,          setLastLat]          = useState(initialLat);
  const [lastLng,          setLastLng]          = useState(initialLng);
  const [showConsent,      setShowConsent]      = useState(false);
  // Firefox-specific: show address-bar guidance while waiting for browser permission
  const [waitingFirefox,   setWaitingFirefox]   = useState(false);
  const [showFirefoxTip,   setShowFirefoxTip]   = useState(false); // "didn't see it?" hint
  const isFirefox = detectFirefox();
  const tipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Push position updates every 2 minutes while live
  useEffect(() => {
    if (!enabled) return;
    const push = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLastLat(pos.coords.latitude);
          setLastLng(pos.coords.longitude);
          fetch("/api/driver/location", {
            method:  "PATCH",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ enabled: true, lat: pos.coords.latitude, lng: pos.coords.longitude }),
          }).catch(() => {});
        },
        () => {},
        { timeout: 15000, maximumAge: 60000 },
      );
    };
    push();
    const interval = setInterval(push, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [enabled]);

  async function enableWithPosition() {
    setSaving(true);
    setError("");

    // Check if already permanently denied
    try {
      const perm = await navigator.permissions.query({ name: "geolocation" as PermissionName });
      if (perm.state === "denied") {
        setError(
          isFirefox
            ? "Firefox has location blocked for this site. Click the lock icon (🔒) in the address bar → click × next to Location → reload the page and try again."
            : "Location is blocked. Click the lock icon in the address bar → Site settings → Allow Location → reload and try again."
        );
        setSaving(false);
        return;
      }
    } catch {
      // permissions API not supported — proceed
    }

    // On Firefox, show address-bar guidance immediately since the prompt is very subtle
    if (isFirefox) {
      setWaitingFirefox(true);
      setShowFirefoxTip(false);
      if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
      tipTimerRef.current = setTimeout(() => setShowFirefoxTip(true), 6000);
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
        setWaitingFirefox(false);
        setShowFirefoxTip(false);
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch("/api/driver/location", {
            method:  "PATCH",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ enabled: true, lat: latitude, lng: longitude }),
          });
          if (res.ok) { setEnabled(true); setLastLat(latitude); setLastLng(longitude); }
        } catch {
          setError("Failed to save location. Please try again.");
        }
        setSaving(false);
      },
      (err) => {
        if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
        setWaitingFirefox(false);
        setShowFirefoxTip(false);
        setError(geoErrorMessage(err, isFirefox));
        setSaving(false);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }

  async function toggle() {
    if (!enabled) {
      if (!navigator.geolocation) {
        setError("Your browser does not support location sharing. Try Chrome, Firefox, or Safari.");
        return;
      }
      setError("");
      setShowConsent(true);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/driver/location", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ enabled: false }),
      });
      if (res.ok) { setEnabled(false); setLastLat(null); setLastLng(null); }
    } catch {
      setError("Failed to update location. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleConsentAgree() {
    setShowConsent(false);
    enableWithPosition();
  }

  function retryFromError() {
    setError("");
    setShowConsent(true);
  }

  return (
    <>
      {/* Consent Modal */}
      {showConsent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📍</span>
              <h2 className="text-lg font-bold text-gray-900">Enable Live Location?</h2>
            </div>
            <p className="text-sm text-gray-600">Got Dirt? will use your device GPS to:</p>
            <ul className="text-sm text-gray-600 space-y-1.5 pl-4 list-disc">
              <li>Show your truck on the buyer map for nearby haul requests</li>
              <li>Track when you arrive and leave job sites</li>
              <li>Enable GPS-verified load logging (you must be stationary)</li>
              <li>Provide an independent load count for dispute resolution</li>
            </ul>
            <p className="text-sm text-gray-500">
              Your location is only shared while this toggle is on. Turn it off any time.
            </p>
            {isFirefox && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 space-y-1">
                <p className="text-xs font-bold text-orange-800">Firefox — important next step</p>
                <p className="text-xs text-orange-700">
                  After tapping &ldquo;I Agree&rdquo;, Firefox will show a <strong>small location bar near the top of your browser window</strong>. Tap <strong>Allow</strong> on that bar — it disappears quickly so watch for it.
                </p>
              </div>
            )}
            <a href="/guidelines/location-tracking" className="text-xs text-amber-600 underline"
              target="_blank" rel="noopener noreferrer">
              View Location Data Guidelines →
            </a>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowConsent(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleConsentAgree}
                className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700">
                I Agree — Enable
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Firefox waiting banner — shown while Firefox is prompting in the address bar */}
      {waitingFirefox && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-10 px-4 pointer-events-none">
          <div className="bg-gray-900 text-white rounded-2xl shadow-2xl max-w-sm w-full p-5 space-y-3 pointer-events-auto">
            <div className="flex items-center gap-3">
              <span className="text-2xl animate-bounce">☝️</span>
              <div>
                <p className="font-bold text-sm">Check the top of your browser</p>
                <p className="text-xs text-gray-300 mt-0.5">
                  Firefox is showing a <strong className="text-white">location permission bar</strong> near your address bar. Tap <strong className="text-green-400">Allow</strong> to continue.
                </p>
              </div>
            </div>

            {/* Visual arrow pointing up */}
            <div className="flex items-center gap-2 bg-gray-800 rounded-xl px-3 py-2 text-xs text-gray-300">
              <span>🔒</span>
              <span className="flex-1">gotdirt.us</span>
              <span className="bg-blue-600 text-white px-2 py-0.5 rounded font-bold text-xs">Allow</span>
              <span className="text-gray-500 px-2">Block</span>
            </div>
            <p className="text-xs text-gray-400">This is what the Firefox prompt looks like — tap Allow on the real one above.</p>

            {showFirefoxTip && (
              <div className="border-t border-gray-700 pt-3 space-y-2">
                <p className="text-xs text-gray-400">
                  Don&apos;t see it? The bar may have timed out.
                </p>
                <button
                  onClick={() => {
                    setWaitingFirefox(false);
                    setShowFirefoxTip(false);
                    enableWithPosition();
                  }}
                  className="w-full py-2 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toggle Card */}
      <div className={`rounded-2xl border p-5 transition-colors ${enabled ? "bg-green-50 border-green-200" : "bg-white border-gray-200"}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${enabled ? "bg-green-500 animate-pulse" : "bg-gray-300"}`} />
              <p className="font-semibold text-gray-900">Live Location</p>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {enabled
                ? lastLat ? `Broadcasting · ${lastLat.toFixed(4)}, ${lastLng?.toFixed(4)}` : "Acquiring position…"
                : "Enable to appear on the buyer map and unlock GPS load logging"}
            </p>
            {error && (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-red-600">{error}</p>
                {isFirefox && error.includes("blocked") && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-orange-800 space-y-1">
                    <p className="font-bold">Reset Firefox location permission:</p>
                    <ol className="list-decimal pl-4 space-y-1">
                      <li>Click the <strong>🔒 lock icon</strong> at the left of the address bar</li>
                      <li>Find <strong>Location</strong> in the permissions list</li>
                      <li>Click the <strong>× (X)</strong> next to it to clear the block</li>
                      <li>Tap <strong>Try Again</strong> below — Firefox will ask again</li>
                    </ol>
                  </div>
                )}
                <button onClick={retryFromError}
                  className="text-xs text-amber-600 font-semibold underline">
                  Try Again →
                </button>
              </div>
            )}
          </div>
          <button onClick={toggle} disabled={saving}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50
              ${enabled ? "bg-green-500" : "bg-gray-200"}`}>
            <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform duration-200
              ${enabled ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>
      </div>
    </>
  );
}
