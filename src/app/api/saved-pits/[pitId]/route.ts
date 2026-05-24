import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: { pitId: string } };

// POST /api/saved-pits/[pitId] — save a pit
export async function POST(_req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const saved = await prisma.savedPit.upsert({
    where: { userId_pitId: { userId: session.user.id, pitId: params.pitId } },
    create: { userId: session.user.id, pitId: params.pitId },
    update: {},
  });

  return NextResponse.json({ saved }, { status: 201 });
}

// DELETE /api/saved-pits/[pitId] — unsave
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.savedPit.deleteMany({
    where: { userId: session.user.id, pitId: params.pitId },
  });

  return NextResponse.json({ ok: true });
}
