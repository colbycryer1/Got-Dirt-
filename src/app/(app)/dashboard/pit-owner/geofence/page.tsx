import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function GeofencePage() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "PIT_OWNER" && session.user.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  const pits = await prisma.pit.findMany({
    where: { ownerId: session.user.id, status: "ACTIVE" },
    select: { id: true, name: true, latitude: true, longitude: true, geofenceRadiusMeters: true, address: true },
  });

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const defaultPit = pits[0];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/pit-owner" className="text-amber-600 text-sm font-medium">← Dashboard</Link>
        <span className="font-black text-black text-lg">Got Dirt?</span>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8 w-full space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Geofence Map</h1>
            <p className="text-sm text-gray-500 mt-1">Read-only view of your pit geofences. Radius is set by Got Dirt? admin.</p>
          </div>
        </div>

        {pits.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-400">
            <p>No active pits to display.</p>
          </div>
        ) : (
          <>
            {/* Pit list */}
            <div className="grid sm:grid-cols-2 gap-3">
              {pits.map((pit) => (
                <div key={pit.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="font-semibold text-gray-900">{pit.name}</p>
                  {pit.address && <p className="text-sm text-gray-500">{pit.address}</p>}
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                    <span>📍 {pit.latitude.toFixed(5)}, {pit.longitude.toFixed(5)}</span>
                    <span>·</span>
                    <span>⭕ {pit.geofenceRadiusMeters}m radius</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Map embed with geofence circles */}
            {defaultPit && apiKey && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden" style={{ height: 480 }}>
                <GeofenceMapClient pits={pits} apiKey={apiKey} />
              </div>
            )}

            {!apiKey && (
              <div className="bg-gray-50 rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-400">
                <p className="font-medium">Map unavailable</p>
                <p className="text-sm mt-1">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not configured.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Inline client component for the map (avoids separate file)
function GeofenceMapClient({ pits, apiKey }: {
  pits: { id: string; name: string; latitude: number; longitude: number; geofenceRadiusMeters: number }[];
  apiKey: string;
}) {
  const center = pits[0];
  const mapSrc = `https://www.google.com/maps/embed/v1/view?key=${apiKey}&center=${center.latitude},${center.longitude}&zoom=15&maptype=satellite`;

  // We render an iframe for a simple read-only view.
  // For proper circle overlays, the full JS SDK is needed (available in MapContainer).
  return (
    <div className="relative w-full h-full">
      <iframe
        src={mapSrc}
        className="w-full h-full border-0"
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        title="Geofence Map"
      />
      <div className="absolute bottom-0 left-0 right-0 bg-white/90 px-4 py-2 text-xs text-gray-500">
        Geofence radius ({pits[0]?.geofenceRadiusMeters}m) is managed by Got Dirt? admin only.
      </div>
    </div>
  );
}
