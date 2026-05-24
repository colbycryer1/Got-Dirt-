import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { isBuyerRole } from "@/types";

// GET /api/drivers/nearby?lat=&lng=&radius=50 (miles)
// Returns live drivers within radius. Rate field EXCLUDED — fetched separately on order creation.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isBuyerRole(session.user.role) && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const lat    = parseFloat(searchParams.get("lat") ?? "");
  const lng    = parseFloat(searchParams.get("lng") ?? "");
  const radius = parseFloat(searchParams.get("radius") ?? "50");

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
  }

  // Haversine bounding box (fast pre-filter)
  const latDelta = radius / 69;
  const lngDelta = radius / (69 * Math.cos((lat * Math.PI) / 180));

  const drivers = await prisma.driverProfile.findMany({
    where: {
      liveLocationEnabled: true,
      profilePublic:       true,
      currentLat: { gte: lat - latDelta, lte: lat + latDelta },
      currentLng: { gte: lng - lngDelta, lte: lng + lngDelta },
      // Only show location if updated in last 4 hours
      lastLocationAt: { gte: new Date(Date.now() - 4 * 3600 * 1000) },
    },
    select: {
      id:            true,
      currentLat:    true,
      currentLng:    true,
      truckType:     true,
      lastLocationAt: true,
      user:          { select: { name: true } },
      // haulRateCents intentionally EXCLUDED here — shown only on order creation
    },
  });

  return NextResponse.json({ drivers });
}
