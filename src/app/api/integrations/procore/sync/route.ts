import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createProcoreDirectCost } from "@/lib/integrations/procore";
import { getValidToken } from "@/lib/integrations/getValidToken";

// POST /api/integrations/procore/sync  { settlementId }
// Pushes a settlement as a Direct Cost to the linked Procore project
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { settlementId } = await req.json() as { settlementId: string };

  const settlement = await prisma.settlement.findUniqueOrThrow({
    where: { id: settlementId },
    include: {
      order: {
        include: {
          pit: true,
          project: true,
          buyer: true,
        },
      },
    },
  });

  if (settlement.order.buyerUserId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const project = settlement.order.project;
  if (!project.procoreProjectId || !project.procoreCompanyId) {
    return NextResponse.json(
      { error: "Project has no Procore IDs configured. Edit project settings first." },
      { status: 400 }
    );
  }

  let accessToken: string;
  try {
    accessToken = await getValidToken(session.user.id, "PROCORE");
  } catch {
    return NextResponse.json(
      { error: "Procore not connected. Connect in Settings first.", syncError: true },
      { status: 400 }
    );
  }

  try {
    const result = await createProcoreDirectCost(
      accessToken,
      project.procoreCompanyId,
      project.procoreProjectId,
      {
        description: `Got Dirt — ${settlement.order.pit.name} — ${settlement.verifiedLoadCount} loads`,
        date: settlement.date.toISOString().split("T")[0],
        totalAmount: settlement.grossAmountCents / 100,
        vendorId: project.procoreVendorId ?? undefined,
        costCodeId: project.procoreCostCodeId ?? undefined,
        lineItemTypeId: project.procoreLineItemTypeId ?? undefined,
        invoiceNumber: `GD-${settlementId.slice(-8).toUpperCase()}`,
      }
    );

    await prisma.integrationConnection.update({
      where: { buyerUserId_platform: { buyerUserId: session.user.id, platform: "PROCORE" } },
      data: { lastSyncAt: new Date(), lastSyncError: null },
    });

    return NextResponse.json({ ok: true, procoreId: result?.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Procore sync failed";
    await prisma.integrationConnection.update({
      where: { buyerUserId_platform: { buyerUserId: session.user.id, platform: "PROCORE" } },
      data: { lastSyncError: msg },
    });
    return NextResponse.json({ error: msg, syncError: true }, { status: 502 });
  }
}
