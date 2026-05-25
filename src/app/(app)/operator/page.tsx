"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";

interface LoadEvent {
  id: string;
  materialType: string;
  rateCentsAtTime: number;
  createdAt: string;
}

interface Order {
  id: string;
  date: string;
  orderType: "BORROW" | "DUMP";
  buyer: { name: string | null; company: string | null; phone: string | null };
  pit: {
    name: string;
    materialTypes: string[];
    dumpRateCents: number | null;
    borrowRateCents: number | null;
    topsoilRateCents: number | null;
    materialRatesCents: Record<string, number> | null;
  };
  loadEvents: LoadEvent[];
}

// Material type → display color
const MATERIAL_COLORS: Record<string, string> = {
  "Fill Dirt (Clean)":  "bg-amber-500   hover:bg-amber-600",
  "Top Soil":           "bg-stone-600   hover:bg-stone-700",
  "Sand":               "bg-yellow-400  hover:bg-yellow-500",
  "Mulch":              "bg-lime-700    hover:bg-lime-800",
  "#57 Stone":          "bg-slate-500   hover:bg-slate-600",
  "#34 Stone":          "bg-slate-600   hover:bg-slate-700",
  "GAB":                "bg-zinc-600    hover:bg-zinc-700",
  "Class 1 Rip Rap":    "bg-blue-800    hover:bg-blue-900",
  "Class 2 Rip Rap":    "bg-blue-600    hover:bg-blue-700",
  "Class 3 Rip Rap":    "bg-blue-400    hover:bg-blue-500",
};

const MATERIAL_TEXT: Record<string, string> = {
  "Fill Dirt (Clean)":  "text-white",
  "Top Soil":           "text-white",
  "Sand":               "text-gray-900",
  "Mulch":              "text-white",
  "#57 Stone":          "text-white",
  "#34 Stone":          "text-white",
  "GAB":                "text-white",
  "Class 1 Rip Rap":    "text-white",
  "Class 2 Rip Rap":    "text-white",
  "Class 3 Rip Rap":    "text-gray-900",
};

function defaultColor(material: string) {
  return MATERIAL_COLORS[material] ?? "bg-gray-600 hover:bg-gray-700";
}
function defaultText(material: string) {
  return MATERIAL_TEXT[material] ?? "text-white";
}

export default function OperatorPage() {
  const { data: session, status } = useSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [pendingMaterial, setPendingMaterial] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);
  const [flashMaterial, setFlashMaterial] = useState<string | null>(null);
  const [lastLogged, setLastLogged] = useState<{ material: string; time: Date } | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/operator/orders");
      const data = await res.json();
      const list: Order[] = data.orders ?? [];
      setOrders(list);
      if (list.length === 1 && !selectedOrder) setSelectedOrder(list[0]);
    } finally {
      setLoading(false);
    }
  }, [selectedOrder]);

  useEffect(() => {
    if (status === "authenticated") fetchOrders();
  }, [status, fetchOrders]);

  if (status === "loading") return <Loading />;
  if (status === "unauthenticated") {
    if (typeof window !== "undefined") window.location.href = "/login";
    return null;
  }

  const role = session?.user?.role;
  if (role !== "PIT_OWNER" && role !== "ADMIN") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900 mb-2">Access denied</p>
          <p className="text-gray-500 text-sm">Pit operator access required.</p>
        </div>
      </div>
    );
  }

  function handleMaterialTap(material: string) {
    if (logging) return;

    if (pendingMaterial === material) {
      // Second tap — confirm and log
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
      setPendingMaterial(null);
      logLoad(material);
    } else {
      // First tap — prime for confirmation
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
      setPendingMaterial(material);
      // Auto-cancel after 4 seconds
      pendingTimer.current = setTimeout(() => setPendingMaterial(null), 4000);
    }
  }

  function optimisticAdd(order: Order, material: string): Order {
    return {
      ...order,
      loadEvents: [
        ...order.loadEvents,
        { id: `opt-${Date.now()}`, materialType: material, rateCentsAtTime: 0, createdAt: new Date().toISOString() },
      ],
    };
  }

  function optimisticRemoveLast(order: Order): Order {
    return { ...order, loadEvents: order.loadEvents.slice(0, -1) };
  }

  function applyOrderUpdate(updated: Order) {
    setSelectedOrder(updated);
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  }

  async function logLoad(material: string) {
    if (!selectedOrder || logging) return;
    setLogging(true);

    // Optimistic: update count instantly, flash the button
    const snapshot = selectedOrder;
    applyOrderUpdate(optimisticAdd(selectedOrder, material));
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlashMaterial(material);
    flashTimer.current = setTimeout(() => setFlashMaterial(null), 700);

    try {
      const res = await fetch("/api/loads/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: selectedOrder.id, materialType: material }),
      });
      if (!res.ok) {
        const err = await res.json();
        applyOrderUpdate(snapshot); // revert
        alert(err.error ?? "Failed to log load");
        return;
      }
      const now = new Date();
      setLastLogged({ material, time: now });
      setCanUndo(true);
      if (undoTimer.current) clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setCanUndo(false), 2 * 60 * 1000);
      // Background sync — don't await, count already correct
      fetchOrders();
    } finally {
      setLogging(false);
    }
  }

  async function handleUndo() {
    if (!selectedOrder || !canUndo || logging) return;
    setLogging(true);

    // Optimistic: remove last event instantly
    const snapshot = selectedOrder;
    applyOrderUpdate(optimisticRemoveLast(selectedOrder));

    try {
      const res = await fetch(`/api/loads/manual?orderId=${selectedOrder.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        applyOrderUpdate(snapshot); // revert
        alert(err.error ?? "Could not undo");
        return;
      }
      setCanUndo(false);
      setLastLogged(null);
      if (undoTimer.current) clearTimeout(undoTimer.current);
      fetchOrders();
    } finally {
      setLogging(false);
    }
  }

  // Compute today's load count by material for the selected order
  const todayCounts: Record<string, number> = {};
  if (selectedOrder) {
    for (const e of selectedOrder.loadEvents) {
      todayCounts[e.materialType] = (todayCounts[e.materialType] ?? 0) + 1;
    }
  }
  const totalToday = Object.values(todayCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <span className="font-black text-white text-lg">Got Dirt?</span>
        {orders.length > 1 && (
          <button
            className="text-amber-400 text-sm font-medium"
            onClick={() => setSelectedOrder(null)}
          >
            Switch Order
          </button>
        )}
      </header>

      {/* Order selector */}
      {!selectedOrder && !loading && (
        <div className="flex-1 p-4">
          <h2 className="text-lg font-bold mb-4 text-gray-100">Select Active Order</h2>
          {orders.length === 0 ? (
            <div className="text-center text-gray-400 mt-20">
              <p className="text-5xl mb-4">📋</p>
              <p className="font-semibold text-gray-300">No active orders today</p>
              <p className="text-sm text-gray-500 mt-2">Orders appear here when a buyer places one for your pit.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setSelectedOrder(o)}
                  className="w-full bg-gray-800 rounded-2xl p-4 text-left border border-gray-700 hover:border-amber-500 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-white">{o.pit.name}</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      o.orderType === "DUMP"
                        ? "bg-orange-900 text-orange-300"
                        : "bg-blue-900 text-blue-300"
                    }`}>
                      {o.orderType === "DUMP" ? "Dump" : "Borrow"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">{o.buyer.company ?? o.buyer.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{o.loadEvents.length} loads today</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main load tracking UI */}
      {selectedOrder && (
        <div className="flex-1 flex flex-col p-4 gap-4">
          {/* Order info */}
          <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-1">
              <p className="font-bold text-white text-base">{selectedOrder.pit.name}</p>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                selectedOrder.orderType === "DUMP"
                  ? "bg-orange-900 text-orange-300"
                  : "bg-blue-900 text-blue-300"
              }`}>
                {selectedOrder.orderType === "DUMP" ? "DROP-OFF (Dump)" : "PICK-UP (Borrow)"}
              </span>
            </div>
            <p className="text-gray-400 text-sm">{selectedOrder.buyer.company ?? selectedOrder.buyer.name}</p>
            {selectedOrder.buyer.phone && (
              <a href={`tel:${selectedOrder.buyer.phone}`} className="text-amber-400 text-xs mt-1 block">
                {selectedOrder.buyer.phone}
              </a>
            )}
          </div>

          {/* Today's count */}
          <div className="bg-gray-800 rounded-2xl p-5 text-center border border-gray-700">
            <p className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-1">Today&apos;s Loads</p>
            <p className="text-7xl font-black text-white leading-none">{totalToday}</p>
            {Object.entries(todayCounts).map(([mat, cnt]) => (
              <p key={mat} className="text-sm text-gray-400 mt-2">
                {mat}: <span className="font-bold text-gray-200">{cnt}</span>
              </p>
            ))}
          </div>

          {/* Pending confirmation banner */}
          {pendingMaterial && (
            <div className="bg-amber-500 text-gray-900 rounded-2xl p-4 text-center animate-pulse">
              <p className="font-black text-lg">Tap <span className="underline">{pendingMaterial}</span> again to confirm</p>
              <p className="text-sm font-medium mt-1">or tap a different material to change</p>
            </div>
          )}

          {/* Material buttons */}
          <div>
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">
              Tap once to select · Tap again to log load
            </p>
            <div className="grid grid-cols-2 gap-3">
              {selectedOrder.pit.materialTypes.map((material) => {
                const isPending = pendingMaterial === material;
                const isFlash  = flashMaterial === material;
                const count = todayCounts[material] ?? 0;
                return (
                  <button
                    key={material}
                    onClick={() => handleMaterialTap(material)}
                    className={[
                      "relative rounded-2xl p-4 text-left transition-all duration-150 select-none active:scale-95",
                      defaultColor(material),
                      defaultText(material),
                      isPending ? "ring-4 ring-white ring-offset-2 ring-offset-gray-950 scale-[1.04]" : "",
                      isFlash   ? "ring-4 ring-green-400 ring-offset-2 ring-offset-gray-950 scale-95" : "",
                    ].join(" ")}
                  >
                    <p className="font-bold text-sm leading-tight">{material}</p>
                    <p className="text-xs mt-1 opacity-80 tabular-nums min-h-[1rem]">
                      {isFlash ? "✓ Logged!" : count > 0 ? `${count} today` : ""}
                    </p>
                    {isPending && !isFlash && (
                      <span className="absolute top-2 right-2 text-lg">✓?</span>
                    )}
                  </button>
                );
              })}
            </div>

            {selectedOrder.pit.materialTypes.length === 0 && (
              <div className="text-center text-gray-500 py-10">
                <p>No material types configured for this pit.</p>
                <p className="text-sm mt-1">Ask the pit admin to update the listing.</p>
              </div>
            )}
          </div>

          {/* Undo */}
          {canUndo && lastLogged && (
            <button
              onClick={handleUndo}
              disabled={logging}
              className="w-full bg-gray-800 border border-red-700 text-red-400 rounded-2xl py-3 font-semibold text-sm hover:bg-red-950 transition-colors"
            >
              ↩ Undo last — {lastLogged.material} ({lastLogged.time.toLocaleTimeString()})
            </button>
          )}

          {/* Last entry */}
          {lastLogged && !canUndo && (
            <p className="text-center text-xs text-gray-600">
              Last: {lastLogged.material} at {lastLogged.time.toLocaleTimeString()} (undo window closed)
            </p>
          )}
        </div>
      )}

      {loading && <Loading />}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
