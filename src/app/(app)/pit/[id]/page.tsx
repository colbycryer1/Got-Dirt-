import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { pitTypeLabel, centsToDisplay } from "@/types";

export default async function PitDetailPage({ params }: { params: { id: string } }) {
  const pit = await prisma.pit.findUnique({ where: { id: params.id } });
  if (!pit || pit.status === "INACTIVE") notFound();

  const typeLabel = pitTypeLabel(pit.pitType);
  const statusColor = pit.accepting ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800";
  const statusText = pit.accepting ? "Accepting Material" : "Not Accepting";

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link href="/map" className="text-amber-600 hover:text-amber-700 text-sm font-medium">
          ← Back to Map
        </Link>
        <span className="text-gray-300">|</span>
        <Link href="/" className="text-xl font-extrabold text-black">Got Dirt?</Link>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{pit.name}</h1>
              {pit.address && <p className="text-gray-500 mt-1">{pit.address}, {pit.state}</p>}
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusColor}`}>
              {statusText}
            </span>
          </div>

          <div className="mb-6">
            <span className="inline-block bg-gray-100 text-gray-700 text-sm px-3 py-1 rounded-full font-medium">
              {typeLabel}
            </span>
          </div>

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
                <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide mb-1">Clean Topsoil Rate</p>
                <p className="text-2xl font-bold text-amber-900">{centsToDisplay(pit.topsoilRateCents)}</p>
                <p className="text-xs text-amber-500">per load</p>
              </div>
            )}
          </div>

          {pit.hasTopsoil && (
            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-4 py-2 rounded-xl mb-6">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
              Clean topsoil stockpile available (separate from other material)
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
                <a href={`tel:${pit.contactPhone}`} className="text-amber-600 text-sm hover:underline block">
                  {pit.contactPhone}
                </a>
              )}
              {pit.contactEmail && (
                <a href={`mailto:${pit.contactEmail}`} className="text-amber-600 text-sm hover:underline block">
                  {pit.contactEmail}
                </a>
              )}
            </div>
          )}

          {/* Pay CTA */}
          {pit.accepting && (pit.dumpRateCents || pit.borrowRateCents || pit.topsoilRateCents) && (
            <Link
              href={`/pit/${pit.id}/pay`}
              className="w-full flex items-center justify-center bg-amber-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-amber-700 transition-colors"
            >
              Pay for This Pit
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
