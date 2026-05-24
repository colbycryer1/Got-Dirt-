import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// DELETE /api/carrier/terminals/[id]
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "CARRIER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const terminal = await prisma.carrierTerminal.findUnique({ where: { id: params.id }, include: { carrier: true } });
  if (!terminal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (terminal.carrier.userId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await prisma.carrierTerminal.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
