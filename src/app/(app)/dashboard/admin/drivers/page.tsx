import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import VerifyButton from "./VerifyButton";

export const metadata = { title: "Driver Verification — Admin" };

export default async function AdminDriversPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") redirect("/dashboard");

  const profiles = await prisma.driverProfile.findMany({
    include: {
      user: { select: { name: true, email: true, phone: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const pending  = profiles.filter((p) => !p.docsVerified && (p.gdotLicenseUrl || p.insuranceUrl));
  const verified = profiles.filter((p) => p.docsVerified);
  const noDocs   = profiles.filter((p) => !p.docsVerified && !p.gdotLicenseUrl && !p.insuranceUrl);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/admin" className="text-amber-600 hover:text-amber-700 text-sm font-medium">← Admin</Link>
        <span className="text-gray-300">|</span>
        <Link href="/" className="font-black text-black text-lg">Got Dirt?</Link>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Driver Verification</h1>
          <div className="flex gap-3 text-sm">
            <span className="bg-amber-100 text-amber-700 font-semibold px-3 py-1 rounded-full">{pending.length} pending</span>
            <span className="bg-green-100 text-green-700 font-semibold px-3 py-1 rounded-full">{verified.length} verified</span>
          </div>
        </div>

        {/* Pending review */}
        {pending.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Pending Review</h2>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["Driver", "Truck", "Rate", "GDOT License", "Insurance", "Additional", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pending.map((p) => (
                    <tr key={p.id} className="hover:bg-amber-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{p.user.name ?? "—"}</p>
                        <p className="text-xs text-gray-400">{p.user.email}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{p.truckType ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{p.haulRateCents ? `$${(p.haulRateCents / 100).toFixed(2)}` : "—"}</td>
                      <td className="px-4 py-3">
                        {p.gdotLicenseUrl
                          ? <a href={p.gdotLicenseUrl} target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:underline font-medium">View ↗</a>
                          : <span className="text-gray-300">Missing</span>}
                      </td>
                      <td className="px-4 py-3">
                        {p.insuranceUrl
                          ? <a href={p.insuranceUrl} target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:underline font-medium">View ↗</a>
                          : <span className="text-gray-300">Missing</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{p.additionalDocUrls.length > 0 ? `${p.additionalDocUrls.length} file${p.additionalDocUrls.length !== 1 ? "s" : ""}` : "—"}</td>
                      <td className="px-4 py-3">
                        <VerifyButton profileId={p.id} verified={false} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Verified */}
        {verified.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Verified Drivers</h2>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["Driver", "Truck", "Rate", "Public", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {verified.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{p.user.name ?? "—"}</p>
                        <p className="text-xs text-gray-400">{p.user.email}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{p.truckType ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{p.haulRateCents ? `$${(p.haulRateCents / 100).toFixed(2)}` : "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${p.profilePublic ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {p.profilePublic ? "Public" : "Hidden"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <VerifyButton profileId={p.id} verified={true} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {noDocs.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">No Documents Uploaded ({noDocs.length})</h2>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 text-sm text-gray-400 text-center">
              {noDocs.length} driver{noDocs.length !== 1 ? "s" : ""} registered but haven&apos;t uploaded documents yet.
            </div>
          </section>
        )}

        {profiles.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
            No driver profiles yet.
          </div>
        )}
      </div>
    </div>
  );
}
