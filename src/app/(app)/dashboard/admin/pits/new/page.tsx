import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PitForm } from "@/components/pit/PitForm";

export default async function AdminNewPitPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/admin/pits" className="text-amber-600 text-sm font-medium">← All Pits</Link>
        <span className="font-extrabold text-black text-lg">Got Dirt?</span>
      </nav>
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Add New Pit</h1>
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <PitForm redirectTo="/dashboard/admin/pits" />
        </div>
      </div>
    </div>
  );
}
