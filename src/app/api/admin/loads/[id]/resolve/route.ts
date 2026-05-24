import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  action: z.enum(["verify", "delete"]),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const load = await prisma.loadEvent.findUnique({ where: { id: params.id } });
  if (!load) return NextResponse.json({ error: "Load not found" }, { status: 404 });

  if (parsed.data.action === "verify") {
    await prisma.loadEvent.update({
      where: { id: params.id },
      data: { disputed: false, verified: true },
    });
    return NextResponse.json({ ok: true, action: "verified" });
  }

  // delete
  await prisma.loadEvent.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true, action: "deleted" });
}
