import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { centsToDisplay, pitTypeLabel } from "@/types";
import { PitStatusToggle } from "@/components/pit/PitStatusToggle";

export default async function PitOwnerPits() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "PIT_OWNER" && session.user.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  const pits = await prisma.pit.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-extrabold text-black text-xl">Got Dirt?</Link>
        <Link
          href="/dashboard/pit-owner/pits/new"
          className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700"
        >
          + Add Pit
        </Link>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">My Pits</h1>

        {pits.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <p className="text-gray-400 mb-4">No pits listed yet.</p>
            <Link href="/dashboard/pit-owner/pits/new" className="text-amber-600 font-medium hover:underline">
              Add your first pit →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {pits.map((pit) => (
              <div key={pit.id} className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-semibold text-gray-900 text-lg">{pit.name}</h2>
                    <p className="text-sm text-gray-500">{pitTypeLabel(pit.pitType)} · {pit.state}</p>
                    <div className="flex gap-4 mt-2 text-sm">
                      {pit.dumpRateCents && <span className="text-orange-600">Dump: {centsToDisplay(pit.dumpRateCents)}/load</span>}
                      {pit.borrowRateCents && <span className="text-blue-600">Borrow: {centsToDisplay(pit.borrowRateCents)}/load</span>}
                      {pit.hasTopsoil && pit.topsoilRateCents && <span className="text-amber-600">Topsoil: {centsToDisplay(pit.topsoilRateCents)}/load</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <PitStatusToggle pitId={pit.id} initialAccepting={pit.accepting} />
                    <Link
                      href={`/dashboard/pit-owner/pits/${pit.id}/edit`}
                      className="text-xs text-gray-500 hover:text-gray-800 underline"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
