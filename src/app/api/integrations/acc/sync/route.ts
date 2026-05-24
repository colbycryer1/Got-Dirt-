import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAccBudgetLineItem } from "@/lib/integrations/acc";
import { getValidToken } from "@/lib/integrations/getValidToken";

// POST /api/integrations/acc/sync  { settlementId }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { settlementId } = await req.json() as { settlementId: string };

  const settlement = await prisma.settlement.findUniqueOrThrow({
    where: { id: settlementId },
    include: {
      order: { include: { pit: true, project: true } },
    },
  });

  if (settlement.order.buyerUserId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const project = settlement.order.project;
  if (!project.accContainerId) {
    return NextResponse.json(
      { error: "Project has no ACC Container ID configured. Edit project settings first." },
      { status: 400 }
    );
  }

  let accessToken: string;
  try {
    accessToken = await getValidToken(session.user.id, "ACC");
  } catch {
    return NextResponse.json(
      { error: "ACC not connected. Connect in Settings first.", syncError: true },
      { status: 400 }
    );
  }

  try {
    const result = await createAccBudgetLineItem(
      accessToken,
      project.accProjectId ?? "",
      project.accContainerId,
      {
        description: `Got Dirt — ${settlement.order.pit.name} — ${settlement.verifiedLoadCount} loads`,
        amount: settlement.grossAmountCents / 100,
        date: settlement.date.toISOString().split("T")[0],
        budgetSegmentId: project.accBudgetSegmentId ?? undefined,
        referenceNumber: `GD-${settlementId.slice(-8).toUpperCase()}`,
      }
    );

    await prisma.integrationConnection.update({
      where: { buyerUserId_platform: { buyerUserId: session.user.id, platform: "ACC" } },
      data: { lastSyncAt: new Date(), lastSyncError: null },
    });

    return NextResponse.json({ ok: true, accId: result?.data?.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "ACC sync failed";
    await prisma.integrationConnection.update({
      where: { buyerUserId_platform: { buyerUserId: session.user.id, platform: "ACC" } },
      data: { lastSyncError: msg },
    });
    return NextResponse.json({ error: msg, syncError: true }, { status: 502 });
  }
}
