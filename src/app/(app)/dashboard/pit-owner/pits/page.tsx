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
        <Link href="/" className="font-black text-black text-xl">Got Dirt?</Link>
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
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-gray-900 text-lg">{pit.name}</h2>
                      <p className="text-sm text-gray-500">{pitTypeLabel(pit.pitType)} · {pit.state}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {pit.borrowRateCents && (
                          <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded-lg">
                            Borrow&nbsp;&nbsp;{centsToDisplay(pit.borrowRateCents)}/load
                          </span>
                        )}
                        {pit.dumpRateCents && (
                          <span className="text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-2 py-1 rounded-lg">
                            Dump&nbsp;&nbsp;{centsToDisplay(pit.dumpRateCents)}/load
                          </span>
                        )}
                        {pit.hasTopsoil && pit.topsoilRateCents && (
                          <span className="text-xs font-semibold text-stone-600 bg-stone-50 border border-stone-200 px-2 py-1 rounded-lg">
                            Topsoil&nbsp;&nbsp;{centsToDisplay(pit.topsoilRateCents)}/load
                          </span>
                        )}
                        {!pit.borrowRateCents && !pit.dumpRateCents && (
                          <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-lg">
                            ⚠ No rates set — loads cannot be logged
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-3 shrink-0">
                      <PitStatusToggle pitId={pit.id} initialAccepting={pit.accepting} />
                      <Link
                        href={`/dashboard/pit-owner/pits/${pit.id}/edit`}
                        className="text-xs bg-gray-100 hover:bg-amber-100 hover:text-amber-700 text-gray-600 px-3 py-1.5 rounded-lg font-semibold transition-colors"
                      >
                        Edit / Set Rate →
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
