import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { searchPitsNear, searchPitsInBounds } from "@/lib/geo";
import { PitType, PitStatus, UserRole } from "@prisma/client";
import { z } from "zod";

// GET /api/pits — search pits by viewport bounds or lat/lng radius
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const pitType = searchParams.get("type") as PitType | null;
  const acceptingParam = searchParams.get("accepting");
  const state = searchParams.get("state") ?? undefined;
  const materialType = searchParams.get("material") ?? undefined;
  const operatorProvidedParam = searchParams.get("operatorProvided");
  const equipmentProvidedParam = searchParams.get("equipmentProvided");

  const filters = {
    pitType: pitType ?? undefined,
    accepting: acceptingParam === "true" ? true : acceptingParam === "false" ? false : undefined,
    state,
    materialType,
    operatorProvided: operatorProvidedParam === "true" ? true : operatorProvidedParam === "false" ? false : undefined,
    equipmentProvided: equipmentProvidedParam === "true" ? true : equipmentProvidedParam === "false" ? false : undefined,
  };

  // Prefer viewport bounds when provided — exact match to what's on screen
  const neLat = parseFloat(searchParams.get("ne_lat") ?? "");
  const neLng = parseFloat(searchParams.get("ne_lng") ?? "");
  const swLat = parseFloat(searchParams.get("sw_lat") ?? "");
  const swLng = parseFloat(searchParams.get("sw_lng") ?? "");

  if (isFinite(neLat) && isFinite(neLng) && isFinite(swLat) && isFinite(swLng)) {
    const pits = await searchPitsInBounds({ neLat, neLng, swLat, swLng, ...filters });
    return NextResponse.json({ pits });
  }

  // Fall back to radius search (used by geolocate / external callers)
  const lat = parseFloat(searchParams.get("lat") ?? "33.749");
  const lng = parseFloat(searchParams.get("lng") ?? "-84.388");
  const radiusMiles = parseFloat(searchParams.get("radius") ?? "50");

  if (!isFinite(lat) || !isFinite(lng)) {
    return NextResponse.json({ error: "Invalid lat/lng" }, { status: 400 });
  }

  const pits = await searchPitsNear({ lat, lng, radiusMeters: radiusMiles * 1609.344, ...filters });
  return NextResponse.json({ pits });
}

const createPitSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().optional(),
  state: z.string().default("GA"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  pitType: z.nativeEnum(PitType),
  accepting: z.boolean().default(true),
  dumpRateCents:      z.number().int().positive().optional(),
  borrowRateCents:    z.number().int().positive().optional(),
  hasTopsoil:         z.boolean().default(false),
  topsoilRateCents:   z.number().int().positive().optional(),
  materialRatesCents: z.record(z.string(), z.number().int().nonnegative()).optional(),
  contactName:  z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  notes:        z.string().optional(),
  materialTypes: z.array(z.string()).optional(),
});

// POST /api/pits — create a pit (auth: PIT_OWNER | ADMIN)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role === UserRole.CONTRACTOR) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createPitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const pit = await prisma.pit.create({
    data: {
      ...data,
      // Admin-created pits are platform-owned (null) so pit owners can claim them.
      // An explicit ownerId in the body lets admin assign directly.
      ownerId: session.user.role === UserRole.ADMIN
        ? (data as { ownerId?: string }).ownerId ?? null
        : session.user.id,
      status: PitStatus.ACTIVE,
    },
  });

  return NextResponse.json({ pit }, { status: 201 });
}
