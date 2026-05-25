import { NextRequest, NextResponse } from "next/server";
import { getMobileToken, verifyMobileJWT } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const token = getMobileToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let user;
  try { user = await verifyMobileJWT(token); } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
  if (user.role !== "PIT_OWNER" && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pits = await prisma.pit.findMany({
    where:   { ownerId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ pits });
}
