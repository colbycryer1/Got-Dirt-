import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET  — list unclaimed pits (for pit owners browsing to claim)
// POST — submit a claim on a pit
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const state  = searchParams.get("state") ?? "";

  // Unclaimed pits = ownerId is null, imported from KMZ
  const pits = await prisma.pit.findMany({
    where: {
      ownerId: null,
      status:  "ACTIVE",
      ...(state  && { state }),
      ...(search && {
        OR: [
          { name:    { contains: search, mode: "insensitive" } },
          { address: { contains: search, mode: "insensitive" } },
        ],
      }),
    },
    include: {
      pitClaims: {
        where: { claimantId: session.user.id },
        select: { id: true, status: true },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
    take: 50,
  });

  return NextResponse.json({ pits });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isPitOwner = session.user.role === "PIT_OWNER" || session.user.role === "ADMIN";
  if (!isPitOwner) return NextResponse.json({ error: "Only pit owners can claim pits" }, { status: 403 });

  const { pitId, message } = await req.json() as { pitId: string; message?: string };
  if (!pitId) return NextResponse.json({ error: "pitId required" }, { status: 400 });

  const pit = await prisma.pit.findUnique({ where: { id: pitId } });
  if (!pit) return NextResponse.json({ error: "Pit not found" }, { status: 404 });
  if (pit.ownerId) return NextResponse.json({ error: "This pit already has an owner" }, { status: 409 });

  const existing = await prisma.pitClaim.findUnique({
    where: { pitId_claimantId: { pitId, claimantId: session.user.id } },
  });
  if (existing) return NextResponse.json({ error: "You already submitted a claim for this pit" }, { status: 409 });

  const claim = await prisma.pitClaim.create({
    data: { pitId, claimantId: session.user.id, message: message ?? null },
  });

  return NextResponse.json({ claim }, { status: 201 });
}
