import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import CarrierProfileForm from "./CarrierProfileForm";
import TerminalManager from "./TerminalManager";

export const metadata = { title: "Carrier Profile — Got Dirt?" };

export default async function CarrierProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "CARRIER" && session.user.role !== "ADMIN") redirect("/dashboard");

  const profile = await prisma.carrierProfile.findUnique({
    where:   { userId: session.user.id },
    include: { terminals: { orderBy: { createdAt: "asc" } } },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/buyer" className="text-amber-600 hover:text-amber-700 text-sm font-medium">← Dashboard</Link>
        <span className="text-gray-300">|</span>
        <Link href="/" className="font-black text-black text-lg">Got Dirt?</Link>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Carrier Profile</h1>
          <p className="text-gray-500 mt-0.5">Manage your public company profile and terminal locations shown to Direct Buyers.</p>
        </div>

        {/* Company profile */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <h2 className="text-lg font-bold text-gray-900 mb-5">Company Information</h2>
          <CarrierProfileForm
            initial={{
              companyName:    profile?.companyName ?? "",
              bio:            profile?.bio ?? "",
              website:        profile?.website ?? "",
              profilePublic:  profile?.profilePublic ?? false,
              haulRateDollars: profile?.haulRateCents ? (profile.haulRateCents / 100).toFixed(2) : "",
            }}
          />
        </div>

        {/* Terminal locations */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Terminal Locations</h2>
              <p className="text-sm text-gray-500 mt-0.5">Shown as pins on the Direct Buyer map.</p>
            </div>
          </div>
          <TerminalManager
            carrierId={profile?.id ?? null}
            initialTerminals={(profile?.terminals ?? []).map((t) => ({
              id:      t.id,
              name:    t.name,
              address: t.address ?? "",
              lat:     t.lat,
              lng:     t.lng,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
