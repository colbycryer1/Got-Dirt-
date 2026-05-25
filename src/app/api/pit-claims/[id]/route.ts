import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: { id: string } };

// PATCH /api/pit-claims/[id]  { action: "approve" | "reject", adminNotes? }
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { action, adminNotes } = await req.json() as {
    action: "approve" | "reject";
    adminNotes?: string;
  };

  if (!["approve", "reject"].includes(action))
    return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });

  const claim = await prisma.pitClaim.findUnique({
    where: { id: params.id },
    include: { pit: { select: { ownerId: true, owner: { select: { role: true } } } } },
  });
  if (!claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  if (claim.status !== "PENDING")
    return NextResponse.json({ error: "Claim already reviewed" }, { status: 409 });

  if (action === "approve") {
    // Block only if the pit is already owned by a non-admin (i.e., another pit owner claimed it)
    if (claim.pit.ownerId && claim.pit.owner?.role !== "ADMIN")
      return NextResponse.json({ error: "Pit already has an owner" }, { status: 409 });

    // Assign pit to claimant and approve claim in a transaction
    await prisma.$transaction([
      prisma.pit.update({
        where: { id: claim.pitId },
        data:  { ownerId: claim.claimantId },
      }),
      prisma.pitClaim.update({
        where: { id: params.id },
        data:  {
          status:     "APPROVED",
          adminNotes: adminNotes ?? null,
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
        },
      }),
      // Reject all other pending claims on the same pit
      prisma.pitClaim.updateMany({
        where: {
          pitId:  claim.pitId,
          id:     { not: params.id },
          status: "PENDING",
        },
        data: {
          status:     "REJECTED",
          adminNotes: "Another claimant was approved.",
          reviewedAt: new Date(),
        },
      }),
    ]);
  } else {
    await prisma.pitClaim.update({
      where: { id: params.id },
      data:  {
        status:     "REJECTED",
        adminNotes: adminNotes ?? null,
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
      },
    });
  }

  return NextResponse.json({ ok: true, action });
}
