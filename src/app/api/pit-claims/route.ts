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
  const search   = searchParams.get("search")?.trim() ?? "";
  const state    = searchParams.get("state") ?? "";
  const forMap   = searchParams.get("forMap") === "true";
  const nearLat  = parseFloat(searchParams.get("nearLat") ?? "");
  const nearLng  = parseFloat(searchParams.get("nearLng") ?? "");
  const hasCoords = !isNaN(nearLat) && !isNaN(nearLng);

  // Build search conditions
  const searchWhere = search
    ? {
        OR: [
          { name:    { contains: search, mode: "insensitive" as const } },
          { address: { contains: search, mode: "insensitive" as const } },
          { state:   { contains: search, mode: "insensitive" as const } },
          { notes:   { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const pits = await prisma.pit.findMany({
    where: {
      // Include pits with no owner, OR pits created by an admin
      // (older pits created before the ownerId:null default was added)
      OR: [
        { ownerId: null },
        { owner: { role: "ADMIN" } },
      ],
      status: "ACTIVE",
      ...(state && { state }),
      ...searchWhere,
      // Coordinate bounding box: ±0.15° ≈ ~10 miles
      ...(hasCoords && !search && {
        latitude:  { gte: nearLat - 0.15, lte: nearLat + 0.15 },
        longitude: { gte: nearLng - 0.15, lte: nearLng + 0.15 },
      }),
    },
    select: {
      id:        true,
      name:      true,
      address:   true,
      state:     true,
      pitType:   true,
      accepting: true,
      latitude:  true,
      longitude: true,
      // Only include claims for map mode if needed
      ...(forMap ? {} : {
        pitClaims: {
          where:  { claimantId: session.user.id },
          select: { id: true, status: true },
          take:   1,
        },
      }),
    },
    orderBy: { name: "asc" },
    take:    forMap ? 500 : 50,
  });

  // For non-map mode, fill in pitClaims on each result
  if (!forMap) {
    return NextResponse.json({ pits });
  }

  // For map mode, fetch the user's claims separately and merge
  const myClaimPitIds = await prisma.pitClaim.findMany({
    where: {
      claimantId: session.user.id,
      pit: { OR: [{ ownerId: null }, { owner: { role: "ADMIN" } }] },
    },
    select: { pitId: true, status: true },
  });
  const claimMap = new Map(myClaimPitIds.map((c) => [c.pitId, c.status]));

  const enriched = pits.map((p) => ({
    ...p,
    myClaimStatus: claimMap.get(p.id) ?? null,
  }));

  return NextResponse.json({ pits: enriched });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isPitOwner = session.user.role === "PIT_OWNER" || session.user.role === "ADMIN";
  if (!isPitOwner) return NextResponse.json({ error: "Only pit owners can claim pits" }, { status: 403 });

  const { pitId, message } = await req.json() as { pitId: string; message?: string };
  if (!pitId) return NextResponse.json({ error: "pitId required" }, { status: 400 });

  const pit = await prisma.pit.findUnique({
    where: { id: pitId },
    include: { owner: { select: { role: true } } },
  });
  if (!pit) return NextResponse.json({ error: "Pit not found" }, { status: 404 });
  // Block claims on pits owned by a non-admin (i.e., already claimed by another pit owner)
  if (pit.ownerId && pit.owner?.role !== "ADMIN") {
    return NextResponse.json({ error: "This pit already has an owner" }, { status: 409 });
  }

  const existing = await prisma.pitClaim.findUnique({
    where: { pitId_claimantId: { pitId, claimantId: session.user.id } },
  });
  if (existing) return NextResponse.json({ error: "You already submitted a claim for this pit" }, { status: 409 });

  const claim = await prisma.pitClaim.create({
    data: { pitId, claimantId: session.user.id, message: message ?? null },
  });

  return NextResponse.json({ claim }, { status: 201 });
}
