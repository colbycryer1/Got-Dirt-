import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isBuyerRole } from "@/types";
import NewHaulOrderForm from "./NewHaulOrderForm";

export const metadata = { title: "New Haul Order — Got Dirt?" };

export default async function NewHaulOrderPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!isBuyerRole(session.user.role) && session.user.role !== "ADMIN") redirect("/dashboard");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [projects, pits, publicDrivers, publicCarriers] = await Promise.all([
    prisma.project.findMany({
      where:   { buyerUserId: session.user.id },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    // All active pits with their daily haul rate lock and borrow (material) rate
    prisma.pit.findMany({
      where:   { status: "ACTIVE" },
      select:  {
        id: true, name: true, address: true, state: true, pitType: true,
        dailyHaulRateCents: true, dailyHaulRateLockedAt: true,
        borrowRateCents: true,
        dumpRateCents:   true,
      },
      orderBy: [{ state: "asc" }, { name: "asc" }],
    }),
    prisma.driverProfile.findMany({
      where:   { profilePublic: true, docsVerified: true },
      select:  {
        id: true, truckType: true, haulRateCents: true,
        liveLocationEnabled: true,
        user: { select: { name: true } },
      },
      orderBy: [{ liveLocationEnabled: "desc" }, { createdAt: "desc" }],
    }),
    prisma.carrierProfile.findMany({
      where:   { profilePublic: true },
      select:  { id: true, companyName: true, haulRateCents: true, user: { select: { name: true } } },
      orderBy: { companyName: "asc" },
    }),
  ]);

  // Build pit daily haul rate map (only if locked today)
  const pitHaulRates: Record<string, number> = {};
  for (const pit of pits) {
    if (pit.dailyHaulRateCents && pit.dailyHaulRateLockedAt && pit.dailyHaulRateLockedAt >= today) {
      pitHaulRates[pit.id] = pit.dailyHaulRateCents;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/buyer/haul-orders" className="text-amber-600 hover:text-amber-700 text-sm font-medium">← Haul Orders</Link>
        <span className="text-gray-300">|</span>
        <Link href="/" className="font-black text-black text-lg">Got Dirt?</Link>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Schedule a Haul Order</h1>
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <NewHaulOrderForm
            projects={projects}
            pits={pits.map((p) => ({
              id:              p.id,
              name:            p.name,
              address:         p.address ?? undefined,
              state:           p.state,
              pitType:         p.pitType,
              borrowRateCents: p.borrowRateCents ?? 0,
              dumpRateCents:   p.dumpRateCents   ?? 0,
            }))}
            pitHaulRates={pitHaulRates}
            drivers={publicDrivers.map((d) => ({
              id:                  d.id,
              name:                d.user.name ?? "Driver",
              truckType:           d.truckType ?? "",
              haulRateCents:       d.haulRateCents ?? 0,
              liveLocationEnabled: d.liveLocationEnabled,
            }))}
            carriers={publicCarriers.map((c) => ({
              id:            c.id,
              name:          c.companyName ?? c.user.name ?? "Carrier",
              haulRateCents: c.haulRateCents ?? 0,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
