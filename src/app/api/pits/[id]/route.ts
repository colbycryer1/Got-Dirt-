import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PitStatus, PitType, UserRole } from "@prisma/client";
import { z } from "zod";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pit = await prisma.pit.findUnique({ where: { id: params.id } });
    if (!pit) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ pit });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[pits/[id] GET] failed:", msg);
    return NextResponse.json({ error: "Failed to load pit" }, { status: 500 });
  }
}

const updatePitSchema = z.object({
  name:             z.string().min(1).max(200).optional(),
  address:          z.string().optional(),
  state:            z.string().optional(),
  latitude:         z.number().min(-90).max(90).optional(),
  longitude:        z.number().min(-180).max(180).optional(),
  pitType:          z.nativeEnum(PitType).optional(),
  accepting:        z.boolean().optional(),
  status:           z.nativeEnum(PitStatus).optional(),
  dumpRateCents:       z.number().int().positive().optional(),
  borrowRateCents:     z.number().int().positive().optional(),
  hasTopsoil:          z.boolean().optional(),
  topsoilRateCents:    z.number().int().positive().optional(),
  materialRatesCents:  z.record(z.string(), z.number().int().nonnegative()).optional(),
  operatorProvided:  z.boolean().optional(),
  equipmentProvided: z.boolean().optional(),
  equipmentNotes:    z.string().optional(),
  hoursOpen:         z.string().optional(),
  hoursClose:        z.string().optional(),
  // geofenceRadiusMeters — admin only, handled below
  contactName:  z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  notes:        z.string().optional(),
  materialTypes: z.array(z.string()).optional(),
  geofenceRadiusMeters: z.number().int().positive().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pit = await prisma.pit.findUnique({ where: { id: params.id } });
  if (!pit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = pit.ownerId === session.user.id;
  const isAdmin = session.user.role === UserRole.ADMIN;
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updatePitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Non-admins cannot change status or geofence radius
  if (!isAdmin) {
    delete parsed.data.status;
    delete parsed.data.geofenceRadiusMeters;
  }

  const updated = await prisma.pit.update({
    where: { id: params.id },
    data: parsed.data,
  });

  return NextResponse.json({ pit: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.pit.update({
    where: { id: params.id },
    data: { status: PitStatus.INACTIVE },
  });

  return NextResponse.json({ success: true });
}
