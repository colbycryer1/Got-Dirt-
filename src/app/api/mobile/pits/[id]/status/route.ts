import { NextRequest, NextResponse } from "next/server";
import { getMobileToken, verifyMobileJWT } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const token = getMobileToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let user;
  try { user = await verifyMobileJWT(token); } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const pit = await prisma.pit.findUnique({ where: { id: params.id } });
  if (!pit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (pit.ownerId !== user.id && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { accepting } = await req.json() as { accepting: boolean };
  const updated = await prisma.pit.update({
    where: { id: params.id },
    data:  { accepting },
    select: { id: true, accepting: true },
  });

  return NextResponse.json({ pit: updated });
}
