import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { pitTypeLabel, centsToDisplay } from "@/types";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import SavePitButton from "@/components/pit/SavePitButton";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const pit = await prisma.pit.findUnique({
    where: { id: params.id },
    select: { name: true, address: true, state: true, pitType: true, accepting: true },
  });
  if (!pit) return { title: "Pit Not Found" };
  const type = pit.pitType === "WASTE" ? "Waste Pit" : pit.pitType === "BORROW" ? "Borrow Pit" : "Waste & Borrow Pit";
  return {
    title: `${pit.name} — ${type} in ${pit.state} | Got Dirt?`,
    description: `${pit.name} is a ${type.toLowerCase()} located in ${pit.address ?? pit.state}. ${pit.accepting ? "Currently accepting material." : "Not currently accepting."} Find dirt pits near you on Got Dirt?`,
  };
}

export default async function PitDetailPage({ params }: { params: { id: string } }) {
  const [pit, session] = await Promise.all([
    prisma.pit.findUnique({ where: { id: params.id } }),
    getServerSession(authOptions),
  ]);
  if (!pit || pit.status === "INACTIVE") notFound();

  const typeLabel = pitTypeLabel(pit.pitType);
  const statusColor = pit.accepting ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800";
  const statusText = pit.accepting ? "Accepting Material" : "Not Accepting";
  const isBuyer = session?.user?.role === "BUYER" || session?.user?.role === "CONTRACTOR";
  const canOrder = isBuyer && pit.accepting && pit.materialTypes.length > 0;

  // Check if logged-in buyer has this pit saved
  let isSaved = false;
  if (session?.user?.id) {
    try {
      const saved = await prisma.savedPit.findUnique({
        where: { userId_pitId: { userId: session.user.id, pitId: pit.id } },
      });
      isSaved = !!saved;
    } catch { /* migration not run yet */ }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link href="/map" className="text-amber-600 hover:text-amber-700 text-sm font-medium">
          ← Back to Map
        </Link>
        <span className="text-gray-300">|</span>
        <Link href="/" className="text-xl font-black text-black">Got Dirt?</Link>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-start justify-between mb-6 gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{pit.name}</h1>
              {pit.address && <p className="text-gray-500 mt-1">{pit.address}, {pit.state}</p>}
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusColor}`}>
                {statusText}
              </span>
              {session?.user && (
                <SavePitButton pitId={pit.id} initialSaved={isSaved} />
              )}
            </div>
          </div>

          <div className="mb-6">
            <span className="inline-block bg-gray-100 text-gray-700 text-sm px-3 py-1 rounded-full font-medium">
              {typeLabel}
            </span>
          </div>

          {/* Operator & Equipment */}
          <div className="grid sm:grid-cols-2 gap-3 mb-6">
            <div className={`rounded-xl p-4 flex items-start gap-3 ${pit.operatorProvided ? "bg-sky-50 border border-sky-200" : "bg-gray-50 border border-gray-200"}`}>
              <span className="text-xl mt-0.5">{pit.operatorProvided ? "✅" : "➖"}</span>
              <div>
                <p className={`text-sm font-semibold ${pit.operatorProvided ? "text-sky-800" : "text-gray-500"}`}>
                  Operator {pit.operatorProvided ? "Provided" : "Not Provided"}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Onsite pit operator</p>
              </div>
            </div>
            <div className={`rounded-xl p-4 flex items-start gap-3 ${pit.equipmentProvided ? "bg-sky-50 border border-sky-200" : "bg-gray-50 border border-gray-200"}`}>
              <span className="text-xl mt-0.5">{pit.equipmentProvided ? "✅" : "➖"}</span>
              <div>
                <p className={`text-sm font-semibold ${pit.equipmentProvided ? "text-sky-800" : "text-gray-500"}`}>
                  Equipment {pit.equipmentProvided ? "Provided" : "Not Provided"}
                </p>
                {pit.equipmentNotes
                  ? <p className="text-xs text-gray-500 mt-0.5">{pit.equipmentNotes}</p>
                  : <p className="text-xs text-gray-400 mt-0.5">Loading equipment</p>
                }
              </div>
            </div>
          </div>

          {/* Hours */}
          {(pit.hoursOpen || pit.hoursClose) && (
            <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 px-4 py-3 rounded-xl mb-6">
              <span>🕐</span>
              <span>
                Hours:{" "}
                <span className="font-semibold">
                  {pit.hoursOpen ?? "—"} – {pit.hoursClose ?? "—"}
                </span>
              </span>
            </div>
          )}

          {/* Rates */}
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            {pit.dumpRateCents && (
              <div className="bg-orange-50 rounded-xl p-4">
                <p className="text-xs text-orange-600 font-semibold uppercase tracking-wide mb-1">Dump Rate</p>
                <p className="text-2xl font-bold text-orange-900">{centsToDisplay(pit.dumpRateCents)}</p>
                <p className="text-xs text-orange-500">per load</p>
              </div>
            )}
            {pit.borrowRateCents && (
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide mb-1">Borrow Rate</p>
                <p className="text-2xl font-bold text-blue-900">{centsToDisplay(pit.borrowRateCents)}</p>
                <p className="text-xs text-blue-500">per load</p>
              </div>
            )}
            {pit.hasTopsoil && pit.topsoilRateCents && (
              <div className="bg-amber-50 rounded-xl p-4">
                <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide mb-1">Topsoil Rate</p>
                <p className="text-2xl font-bold text-amber-900">{centsToDisplay(pit.topsoilRateCents)}</p>
                <p className="text-xs text-amber-500">per load</p>
              </div>
            )}
          </div>

          {/* Materials */}
          {pit.materialTypes.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Available Materials</p>
              <div className="flex flex-wrap gap-2">
                {pit.materialTypes.map((m) => (
                  <span key={m} className="bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-full font-medium">{m}</span>
                ))}
              </div>
            </div>
          )}

          {pit.notes && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Notes</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{pit.notes}</p>
            </div>
          )}

          {/* Contact */}
          {(pit.contactName || pit.contactPhone || pit.contactEmail) && (
            <div className="border-t border-gray-100 pt-6 mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Contact</h3>
              {pit.contactName && <p className="text-gray-800 font-medium">{pit.contactName}</p>}
              {pit.contactPhone && (
                <a href={`tel:${pit.contactPhone}`} className="text-amber-600 text-sm hover:underline block">{pit.contactPhone}</a>
              )}
              {pit.contactEmail && (
                <a href={`mailto:${pit.contactEmail}`} className="text-amber-600 text-sm hover:underline block">{pit.contactEmail}</a>
              )}
            </div>
          )}

          {/* CTA */}
          {pit.accepting && (
            <div className="space-y-3">
              {canOrder && (
                <Link
                  href={`/pit/${pit.id}/order`}
                  className="w-full flex items-center justify-center bg-amber-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-amber-700 transition-colors"
                >
                  Place Order
                </Link>
              )}
              {!session && (
                <Link
                  href={`/login?redirect=/pit/${pit.id}`}
                  className="w-full flex items-center justify-center border border-amber-600 text-amber-600 py-3 rounded-xl font-semibold hover:bg-amber-50 transition-colors"
                >
                  Sign in to Place Order
                </Link>
              )}
              {/* Legacy pay flow still accessible */}
              {(pit.dumpRateCents || pit.borrowRateCents || pit.topsoilRateCents) && (
                <Link
                  href={`/pit/${pit.id}/pay`}
                  className="w-full flex items-center justify-center border border-gray-200 text-gray-500 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors"
                >
                  One-time payment (no project)
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
