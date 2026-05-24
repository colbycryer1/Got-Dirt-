import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  enabled: z.boolean(),
  lat:     z.number().optional(),
  lng:     z.number().optional(),
});

// PATCH /api/driver/location — toggle live location or push a new position
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "DRIVER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { enabled, lat, lng } = parsed.data;

  const profile = await prisma.driverProfile.upsert({
    where:  { userId: session.user.id },
    create: {
      userId:             session.user.id,
      liveLocationEnabled: enabled,
      currentLat:          enabled ? lat : null,
      currentLng:          enabled ? lng : null,
      lastLocationAt:      enabled ? new Date() : null,
    },
    update: {
      liveLocationEnabled: enabled,
      currentLat:          enabled && lat != null ? lat : enabled ? undefined : null,
      currentLng:          enabled && lng != null ? lng : enabled ? undefined : null,
      lastLocationAt:      enabled ? new Date() : null,
    },
  });
  return NextResponse.json({ liveLocationEnabled: profile.liveLocationEnabled });
}
