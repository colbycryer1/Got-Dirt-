import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { searchPitsNear } from "@/lib/geo";
import { PitType, PitStatus, UserRole } from "@prisma/client";
import { z } from "zod";

// GET /api/pits — search pits by location
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const lat = parseFloat(searchParams.get("lat") ?? "33.749");
  const lng = parseFloat(searchParams.get("lng") ?? "-84.388");
  const radiusMiles = parseFloat(searchParams.get("radius") ?? "50");
  const radiusMeters = radiusMiles * 1609.344;
  const pitType = searchParams.get("type") as PitType | null;
  const acceptingParam = searchParams.get("accepting");
  const state = searchParams.get("state") ?? undefined;
  const materialType = searchParams.get("material") ?? undefined;
  const limit = parseInt(searchParams.get("limit") ?? "200");
  const offset = parseInt(searchParams.get("offset") ?? "0");

  if (!isFinite(lat) || !isFinite(lng)) {
    return NextResponse.json({ error: "Invalid lat/lng" }, { status: 400 });
  }

  const pits = await searchPitsNear({
    lat,
    lng,
    radiusMeters,
    pitType: pitType ?? undefined,
    accepting: acceptingParam === "true" ? true : acceptingParam === "false" ? false : undefined,
    state,
    materialType,
    limit,
    offset,
  });

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
  dumpRateCents: z.number().int().positive().optional(),
  borrowRateCents: z.number().int().positive().optional(),
  hasTopsoil: z.boolean().default(false),
  topsoilRateCents: z.number().int().positive().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  notes: z.string().optional(),
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
      ownerId: session.user.role === UserRole.ADMIN ? (data as { ownerId?: string }).ownerId ?? session.user.id : session.user.id,
      status: PitStatus.ACTIVE,
    },
  });

  return NextResponse.json({ pit }, { status: 201 });
}
