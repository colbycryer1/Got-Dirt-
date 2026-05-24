import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { isBuyerRole } from "@/types";

// GET /api/carriers/terminals?ne_lat=&ne_lng=&sw_lat=&sw_lng=
// Returns public carrier terminal locations for buyer map — rate EXCLUDED
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isBuyerRole(session.user.role) && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const neLat = parseFloat(searchParams.get("ne_lat") ?? "");
  const neLng = parseFloat(searchParams.get("ne_lng") ?? "");
  const swLat = parseFloat(searchParams.get("sw_lat") ?? "");
  const swLng = parseFloat(searchParams.get("sw_lng") ?? "");

  const where = !isNaN(neLat) && !isNaN(swLat)
    ? { lat: { gte: swLat, lte: neLat }, lng: { gte: swLng, lte: neLng } }
    : {};

  const terminals = await prisma.carrierTerminal.findMany({
    where: { ...where, carrier: { profilePublic: true } },
    select: {
      id:      true,
      name:    true,
      address: true,
      lat:     true,
      lng:     true,
      carrier: {
        select: {
          id:          true,
          companyName: true,
          // haulRateCents intentionally EXCLUDED — shown only on order creation
          user:        { select: { name: true } },
        },
      },
    },
    take: 100,
  });

  return NextResponse.json({ terminals });
}
