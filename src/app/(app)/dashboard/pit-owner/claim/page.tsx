import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import ClaimPitList from "./ClaimPitList";

export default async function ClaimPitPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const allowed = session.user.role === "PIT_OWNER" || session.user.role === "ADMIN";
  if (!allowed) redirect("/dashboard");

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/pit-owner" className="text-amber-600 text-sm font-medium hover:underline">
          ← My Dashboard
        </Link>
        <span className="font-black text-black text-lg">Got Dirt?</span>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Claim Your Pit</h1>
          <p className="text-gray-500 mt-1 text-sm max-w-xl">
            Got Dirt? uploads pits on behalf of owners who aren&apos;t online yet. Find your pit by
            searching or browsing the map, then submit a claim — our team verifies and transfers
            ownership to your account, usually within one business day.
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <strong>How it works:</strong> Find your pit using the Search or Map tab, click &quot;Claim This Pit&quot;,
          and include any details that help us verify ownership (phone number on file, address, etc.).
          We&apos;ll approve or follow up within 24 hours.
        </div>

        <ClaimPitList apiKey={apiKey} />
      </div>
    </div>
  );
}
