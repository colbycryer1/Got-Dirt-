"use client";

import { useState, useEffect } from "react";

interface ActiveHaulOrder {
  id:               string;
  driverId:         string | null;
  loads:            number;
  status:           string;
  buyerName:        string;
  haulerName:       string;
  pitName:          string;
  pitId:            string;
  scheduledDateStr: string;
  pitOwnerApproved: boolean | null;
}

interface Props {
  orders: ActiveHaulOrder[];
  pitIds: string[];
}

const statusColors: Record<string, string> = {
  PENDING:   "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-green-100 text-green-700",
  ACTIVE:    "bg-blue-100 text-blue-700",
  COMPLETED: "bg-gray-100 text-gray-500",
  CANCELLED: "bg-gray-100 text-gray-400",
  DENIED:    "bg-red-100 text-red-700",
};

export default function OnSitePanel({ orders, pitIds }: Props) {
  const [onSiteMap, setOnSiteMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (pitIds.length === 0) return;

    async function pollAll() {
      const results = await Promise.allSettled(
        pitIds.map((pitId) =>
          fetch(`/api/pits/${pitId}/on-site-drivers`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
        )
      );

      const merged: Record<string, boolean> = {};
      for (const result of results) {
        if (result.status === "fulfilled" && result.value?.onSite) {
          for (const entry of result.value.onSite as Array<{ orderId: string }>) {
            merged[entry.orderId] = true;
          }
        }
      }
      setOnSiteMap(merged);
    }

    pollAll();
    const interval = setInterval(pollAll, 30_000);
    return () => clearInterval(interval);
  }, [pitIds]);

  if (orders.length === 0) {
    return (
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Accepted Haul Orders (0)
        </h2>
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400">
          <p className="text-sm">No accepted haul orders yet</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Accepted Haul Orders ({orders.length})
      </h2>
      <div className="space-y-3">
        {orders.map((order) => {
          const isOnSite = onSiteMap[order.id] === true;

          return (
            <div
              key={order.id}
              className={`bg-white rounded-2xl border p-5 transition-shadow ${
                isOnSite
                  ? "ring-2 ring-amber-400 ring-offset-1 border-amber-200"
                  : "border-indigo-200"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-900">{order.buyerName}</p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        statusColors[order.status] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {order.status}
                    </span>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                      Accepted ✓
                    </span>
                    {isOnSite && (
                      <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-semibold animate-pulse">
                        🚛 On Site
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-gray-500 mt-0.5">{order.pitName}</p>
                  <p className="text-xs text-gray-400">Hauler: {order.haulerName}</p>
                  <p className="text-xs text-gray-400 mt-1">{order.scheduledDateStr}</p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-gray-900">{order.loads}</p>
                  <p className="text-xs text-gray-400">est. loads</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
