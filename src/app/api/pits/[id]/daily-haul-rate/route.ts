import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.union([
  z.object({ rateCents: z.number().int().min(1) }),
  z.object({ clear: z.literal(true) }),
]);

/**
 * PATCH /api/pits/[id]/daily-haul-rate
 * Pit owner locks (or clears) today's haul rate for their pit.
 * When locked, open broadcasts at this pit go to ALL haulers (drivers + carriers).
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pit = await prisma.pit.findUnique({
    where:  { id: params.id },
    select: { id: true, ownerId: true },
  });
  if (!pit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = pit.ownerId === session.user.id || session.user.role === "ADMIN";
  if (!isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const data = "clear" in parsed.data
    ? { dailyHaulRateCents: null, dailyHaulRateLockedAt: null }
    : { dailyHaulRateCents: parsed.data.rateCents, dailyHaulRateLockedAt: new Date() };

  const updated = await prisma.pit.update({ where: { id: params.id }, data });
  return NextResponse.json({
    dailyHaulRateCents:    updated.dailyHaulRateCents,
    dailyHaulRateLockedAt: updated.dailyHaulRateLockedAt,
  });
}

/**
 * GET /api/pits/[id]/daily-haul-rate
 * Returns today's locked haul rate for a pit (public — needed by haul order form).
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const pit = await prisma.pit.findUnique({
    where:  { id: params.id },
    select: { dailyHaulRateCents: true, dailyHaulRateLockedAt: true },
  });
  if (!pit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lockedToday = pit.dailyHaulRateLockedAt && pit.dailyHaulRateLockedAt >= today;

  return NextResponse.json({
    rateCents: lockedToday ? pit.dailyHaulRateCents : null,
    lockedAt:  lockedToday ? pit.dailyHaulRateLockedAt : null,
  });
}
