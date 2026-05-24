import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DriverDashboard() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "DRIVER" && session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-black text-black text-xl">Got Dirt?</Link>
        <span className="text-sm text-gray-500">Driver</span>
      </nav>

      <div className="max-w-lg mx-auto px-6 py-16 text-center">
        <p className="text-6xl mb-6">🚛</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Driver Dashboard</h1>
        <p className="text-gray-500 mb-6">
          The driver mobile app (load tracking, GPS, geofence) is coming in Phase 3.
        </p>
        <p className="text-sm text-gray-400">
          In the meantime, contact your dispatcher or buyer to get assigned to a project.
        </p>
        <div className="mt-8 bg-white rounded-2xl border border-gray-200 p-6 text-left">
          <p className="text-sm font-semibold text-gray-700 mb-1">Signed in as</p>
          <p className="font-medium text-gray-900">{session.user.name ?? session.user.email}</p>
          <p className="text-sm text-gray-400">{session.user.email}</p>
        </div>
      </div>
    </div>
  );
}
