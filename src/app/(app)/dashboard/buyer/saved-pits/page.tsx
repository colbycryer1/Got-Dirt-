import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import SaveButton from "./SaveButton";

export default async function SavedPitsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  let saved: Awaited<ReturnType<typeof fetchSaved>> = [];
  let migrationPending = false;
  try {
    saved = await fetchSaved(session.user.id);
  } catch {
    migrationPending = true;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/buyer" className="text-amber-600 text-sm font-medium hover:underline">
          ← Dashboard
        </Link>
        <span className="font-black text-black text-lg">Got Dirt?</span>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Saved Pits</h1>
          <Link href="/map" className="text-sm bg-amber-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-amber-700">
            Find More Pits →
          </Link>
        </div>

        {migrationPending && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm">
            Saved pits require a database migration. Please contact your administrator.
          </div>
        )}

        {!migrationPending && saved.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <p className="text-4xl mb-3">📌</p>
            <p className="font-semibold text-gray-700">No saved pits yet</p>
            <p className="text-sm text-gray-400 mt-1 mb-4">
              Bookmark pits from the map to find them quickly later.
            </p>
            <Link href="/map" className="text-amber-600 font-medium hover:underline text-sm">
              Browse the map →
            </Link>
          </div>
        )}

        {!migrationPending && saved.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-4">
            {saved.map(({ pit }) => (
              <div key={pit.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/pit/${pit.id}`}
                      className="font-semibold text-gray-900 hover:text-amber-600"
                    >
                      {pit.name}
                    </Link>
                    {pit.address && (
                      <p className="text-sm text-gray-500 mt-0.5">{pit.address}, {pit.state}</p>
                    )}
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {pit.pitType.replace("_", " / ")}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        pit.accepting ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}>
                        {pit.accepting ? "Accepting" : "Closed"}
                      </span>
                      {pit.dumpRateCents && (
                        <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                          Dump ${(pit.dumpRateCents / 100).toFixed(0)}/load
                        </span>
                      )}
                    </div>
                  </div>
                  <SaveButton pitId={pit.id} saved />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

async function fetchSaved(userId: string) {
  return prisma.savedPit.findMany({
    where: { userId },
    include: {
      pit: {
        select: {
          id: true, name: true, address: true, state: true,
          pitType: true, accepting: true, dumpRateCents: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
