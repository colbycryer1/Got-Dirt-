import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import DriverProfileForm from "./DriverProfileForm";

export const metadata = { title: "My Driver Profile — Got Dirt?" };

export default async function DriverProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "DRIVER" && session.user.role !== "ADMIN") redirect("/dashboard");

  const [user, profile] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true } }),
    prisma.driverProfile.findUnique({ where: { userId: session.user.id } }),
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/driver" className="text-amber-600 hover:text-amber-700 text-sm font-medium">← Dashboard</Link>
        <span className="text-gray-300">|</span>
        <Link href="/" className="font-black text-black text-lg">Got Dirt?</Link>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Driver Profile</h1>
          <p className="text-gray-500 mt-0.5">This information is shown to buyers on the map.</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <DriverProfileForm
            initial={{
              bio:              profile?.bio ?? "",
              profilePublic:    profile?.profilePublic ?? false,
              haulRateDollars:  profile?.haulRateCents ? (profile.haulRateCents / 100).toFixed(2) : "",
              truckType:        profile?.truckType ?? "",
              gdotLicenseUrl:   profile?.gdotLicenseUrl ?? "",
              insuranceUrl:     profile?.insuranceUrl ?? "",
              additionalDocUrls: profile?.additionalDocUrls ?? [],
              docsVerified:     profile?.docsVerified ?? false,
            }}
          />
        </div>

        {/* Document upload section */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Compliance Documents</h2>
            {profile?.docsVerified
              ? <span className="text-xs bg-green-100 text-green-700 font-semibold px-3 py-1 rounded-full">✓ Verified</span>
              : <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-3 py-1 rounded-full">Pending Review</span>}
          </div>
          <p className="text-sm text-gray-500">
            Upload your GDOT license, insurance certificate, and any additional documents required for payment and tax compliance.
            Documents are reviewed by Got Dirt? staff before your profile goes live.
          </p>
          <DocumentUploader
            gdotUrl={profile?.gdotLicenseUrl ?? null}
            insuranceUrl={profile?.insuranceUrl ?? null}
            additionalUrls={profile?.additionalDocUrls ?? []}
          />
        </div>
      </div>
    </div>
  );
}

// Server-rendered placeholder — upload widget is client-only, imported dynamically
import dynamic from "next/dynamic";
const DocumentUploader = dynamic(() => import("./DocumentUploader"), { ssr: false });
