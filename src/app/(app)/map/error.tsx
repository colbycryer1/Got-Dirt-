"use client";

import { useEffect } from "react";

export default function MapError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="w-full h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <p className="text-gray-700 font-medium mb-3">Failed to load the map.</p>
        <button
          onClick={reset}
          className="bg-amber-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-amber-700"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
