import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/pending-haul-orders
// Returns pending haul orders (both direct AND broadcast) for the current DRIVER or CARRIER.
// Used by the alert modal to poll for new jobs.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ orders: [] });

  const role = session.user.role;
  if (role !== "DRIVER" && role !== "CARRIER") return NextResponse.json({ orders: [] });

  const now = new Date();

  const include = {
    buyer:   { select: { name: true as const, company: true as const, phone: true as const } },
    pit:     { select: { name: true as const, state: true as const } },
    project: { select: { name: true as const } },
  };

  if (role === "DRIVER") {
    const profile = await prisma.driverProfile.findUnique({
      where:  { userId: session.user.id },
      select: { id: true, docsVerified: true },
    });
    if (!profile) return NextResponse.json({ orders: [] });

    const [direct, broadcast] = await Promise.all([
      prisma.haulOrder.findMany({
        where:   { driverId: profile.id, status: "PENDING" },
        include,
        orderBy: { createdAt: "desc" },
      }),
      // Only verified drivers see broadcast jobs
      profile.docsVerified
        ? prisma.haulOrder.findMany({
            where: {
              driverId:  null,
              carrierId: null,
              status:    "PENDING",
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
            include,
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
    ]);

    return NextResponse.json({
      orders: [
        ...direct.map((o)    => ({ ...o, isBroadcast: false })),
        ...broadcast.map((o) => ({ ...o, isBroadcast: true  })),
      ],
    });
  }

  // CARRIER
  const profile = await prisma.carrierProfile.findUnique({
    where:  { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ orders: [] });

  const [direct, broadcast] = await Promise.all([
    prisma.haulOrder.findMany({
      where:   { carrierId: profile.id, status: "PENDING" },
      include,
      orderBy: { createdAt: "desc" },
    }),
    prisma.haulOrder.findMany({
      where: {
        driverId:  null,
        carrierId: null,
        status:    "PENDING",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    orders: [
      ...direct.map((o)    => ({ ...o, isBroadcast: false })),
      ...broadcast.map((o) => ({ ...o, isBroadcast: true  })),
    ],
  });
}
