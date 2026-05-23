import { MapContainer } from "@/components/map/MapContainer";
import Link from "next/link";

export const metadata = {
  title: "Map — Got Dirt?",
};

export default function MapPage() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  return (
    <div className="flex flex-col h-screen">
      {/* Minimal top bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white z-20 shrink-0">
        <Link href="/" className="font-extrabold text-black text-lg">Got Dirt?</Link>
        <div className="flex gap-3">
          <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">Dashboard</Link>
          <Link href="/login" className="bg-amber-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-amber-700">
            Sign In
          </Link>
        </div>
      </header>

      {/* Full-screen map */}
      <div className="flex-1 relative">
        <MapContainer apiKey={apiKey} />
      </div>
    </div>
  );
}
