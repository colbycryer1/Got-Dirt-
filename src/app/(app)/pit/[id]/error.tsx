"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function PitError({
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">⚠️</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Failed to load pit</h1>
        <p className="text-gray-500 text-sm mb-6">Something went wrong loading this pit&apos;s details.</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="bg-green-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-green-800"
          >
            Try again
          </button>
          <Link
            href="/map"
            className="border border-gray-200 text-gray-600 px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-50"
          >
            ← Back to Map
          </Link>
        </div>
      </div>
    </div>
  );
}
