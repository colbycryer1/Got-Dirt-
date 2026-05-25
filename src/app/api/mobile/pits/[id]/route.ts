import { NextRequest, NextResponse } from "next/server";
import { getMobileToken, verifyMobileJWT } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = getMobileToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await verifyMobileJWT(token); } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const pit = await prisma.pit.findUnique({ where: { id: params.id } });
  if (!pit || pit.status === "INACTIVE") return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ pit });
}
