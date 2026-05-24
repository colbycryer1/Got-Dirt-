import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.integrationConnection.deleteMany({
    where: { buyerUserId: session.user.id, platform: "PROCORE" },
  });

  return NextResponse.json({ ok: true });
}
