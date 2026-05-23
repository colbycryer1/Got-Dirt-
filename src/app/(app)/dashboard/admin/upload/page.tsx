import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { KmzUploader } from "@/components/upload/KmzUploader";

export default async function AdminUploadPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/admin" className="text-amber-600 text-sm font-medium">← Admin</Link>
        <span className="font-extrabold text-black text-lg">Got Dirt?</span>
      </nav>
      <div className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Import Pits from KMZ</h1>
        <p className="text-gray-500 mb-8">
          Upload a Google Earth KMZ file to bulk-import pit locations. Coordinates will be extracted automatically.
        </p>
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <KmzUploader />
        </div>
      </div>
    </div>
  );
}
