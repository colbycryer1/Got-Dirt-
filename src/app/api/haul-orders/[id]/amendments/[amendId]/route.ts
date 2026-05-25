import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const respondSchema = z.object({
  approved: z.boolean(),
  notes: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string; amendId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = respondSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { approved, notes } = parsed.data;

  const amendment = await prisma.haulOrderAmendment.findUnique({
    where: { id: params.amendId },
    include: {
      haulOrder: {
        include: {
          pit: { select: { ownerId: true } },
          driver: { select: { userId: true } },
          carrier: { select: { userId: true } },
        },
      },
    },
  });
  if (!amendment || amendment.haulOrderId !== params.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (amendment.status !== "PENDING") {
    return NextResponse.json({ error: "Amendment is no longer pending" }, { status: 409 });
  }

  const order = amendment.haulOrder;
  const isHauler =
    order.driver?.userId === session.user.id ||
    order.carrier?.userId === session.user.id;
  const isPitOwner = order.pit?.ownerId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";

  if (!isHauler && !isPitOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updateData: Record<string, unknown> = {};
  if (isHauler || isAdmin) {
    updateData.haulerApproved    = approved;
    updateData.haulerRespondedAt = new Date();
    updateData.haulerNotes       = notes ?? null;
  }
  if (isPitOwner || isAdmin) {
    updateData.pitOwnerApproved    = approved;
    updateData.pitOwnerRespondedAt = new Date();
    updateData.pitOwnerNotes       = notes ?? null;
  }

  // Determine new status after this response
  const newHaulerApproved   = (isHauler || isAdmin) ? approved : amendment.haulerApproved;
  const newPitOwnerApproved = (isPitOwner || isAdmin) ? approved : amendment.pitOwnerApproved;

  let newStatus = "PENDING";
  if (!approved) {
    newStatus = "DENIED";
  } else if (newHaulerApproved === true && newPitOwnerApproved === true) {
    newStatus = "APPROVED";
  }
  updateData.status    = newStatus;
  updateData.updatedAt = new Date();

  const updated = await prisma.haulOrderAmendment.update({
    where: { id: params.amendId },
    data: updateData,
  });

  return NextResponse.json({ amendment: updated });
}
