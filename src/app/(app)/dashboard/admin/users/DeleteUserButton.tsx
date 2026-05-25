"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteUserButton({ userId, userName }: { userId: string; userName: string | null }) {
  const [confirming, setConfirming] = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const router = useRouter();

  async function handleDelete() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to delete user");
      setLoading(false);
      setConfirming(false);
      return;
    }
    router.refresh();
  }

  if (error) {
    return <span className="text-xs text-red-500">{error}</span>;
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Delete {userName ?? "user"}?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-2 py-1 rounded-lg disabled:opacity-50 transition-colors"
        >
          {loading ? "Deleting…" : "Yes, Delete"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs text-gray-400 hover:text-red-600 transition-colors font-medium"
    >
      Delete
    </button>
  );
}
