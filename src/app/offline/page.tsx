"use client";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="text-6xl mb-4">🌐</div>
        <h1 className="text-2xl font-black text-gray-900 mb-2">You&apos;re offline</h1>
        <p className="text-gray-500 mb-6">
          Got Dirt? needs a connection to load pits and orders. Check your internet and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="bg-amber-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-amber-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
