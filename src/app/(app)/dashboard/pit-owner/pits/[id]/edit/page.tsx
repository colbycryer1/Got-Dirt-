import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PitForm } from "@/components/pit/PitForm";

export default async function PitOwnerEditPitPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "PIT_OWNER" && session.user.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  const pit = await prisma.pit.findUnique({ where: { id: params.id } });
  if (!pit) notFound();

  // Pit owners can only edit their own pits
  if (session.user.role === "PIT_OWNER" && pit.ownerId !== session.user.id) {
    redirect("/dashboard/pit-owner/pits");
  }

  const initialData = {
    name: pit.name,
    address: pit.address ?? "",
    state: pit.state,
    latitude: String(pit.latitude),
    longitude: String(pit.longitude),
    pitType: pit.pitType as "WASTE" | "BORROW" | "WASTE_BORROW",
    accepting: pit.accepting,
    dumpRateDollars: pit.dumpRateCents ? String(pit.dumpRateCents / 100) : "",
    borrowRateDollars: pit.borrowRateCents ? String(pit.borrowRateCents / 100) : "",
    hasTopsoil: pit.hasTopsoil,
    topsoilRateDollars: pit.topsoilRateCents ? String(pit.topsoilRateCents / 100) : "",
    operatorProvided:  pit.operatorProvided,
    equipmentProvided: pit.equipmentProvided,
    equipmentNotes:    pit.equipmentNotes ?? "",
    hoursOpen:         pit.hoursOpen ?? "",
    hoursClose:        pit.hoursClose ?? "",
    contactName:  pit.contactName ?? "",
    contactPhone: pit.contactPhone ?? "",
    contactEmail: pit.contactEmail ?? "",
    notes:        pit.notes ?? "",
    materialTypes: (pit as { materialTypes?: string[] }).materialTypes ?? [],
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/pit-owner/pits" className="text-amber-600 text-sm font-medium">← My Pits</Link>
        <span className="font-black text-black text-lg">Got Dirt?</span>
      </nav>
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Edit Pit</h1>
        <p className="text-gray-500 text-sm mb-8">{pit.name}</p>
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <PitForm
            initialData={initialData}
            pitId={pit.id}
            redirectTo="/dashboard/pit-owner/pits"
          />
        </div>
      </div>
    </div>
  );
}
