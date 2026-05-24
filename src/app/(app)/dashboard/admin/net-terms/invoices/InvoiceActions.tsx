"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function InvoiceActions({
  invoiceId,
  status,
}: {
  invoiceId: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (status === "PAID" || status === "WRITTEN_OFF") {
    return <span className="text-gray-300 text-xs">—</span>;
  }

  async function update(newStatus: "PAID" | "WRITTEN_OFF") {
    if (newStatus === "WRITTEN_OFF" && !confirm("Mark this invoice as written off? This cannot be undone.")) return;
    setLoading(true);
    await fetch(`/api/admin/net-terms/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => update("PAID")}
        disabled={loading}
        className="px-2.5 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded text-xs font-medium disabled:opacity-50"
      >
        Mark Paid
      </button>
      <button
        onClick={() => update("WRITTEN_OFF")}
        disabled={loading}
        className="px-2.5 py-1 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded text-xs font-medium disabled:opacity-50"
      >
        Write Off
      </button>
    </div>
  );
}
