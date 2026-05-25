import { NextRequest, NextResponse } from "next/server";
import { getMobileToken, verifyMobileJWT } from "@/lib/mobile-auth";
import { searchPitsNear } from "@/lib/geo";

export async function GET(req: NextRequest) {
  const token = getMobileToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await verifyMobileJWT(token); } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const lat        = parseFloat(searchParams.get("lat")    ?? "33.749");
  const lng        = parseFloat(searchParams.get("lng")    ?? "-84.388");
  const radius     = parseFloat(searchParams.get("radius") ?? "50");
  const accepting  = searchParams.get("accepting");
  const pitType    = searchParams.get("type") ?? undefined;
  const state      = searchParams.get("state") ?? undefined;

  const pits = await searchPitsNear({
    lat,
    lng,
    radiusMeters:     radius * 1609.344,
    accepting:        accepting === "true" ? true : accepting === "false" ? false : undefined,
    pitType:          pitType as never,
    state,
  });

  return NextResponse.json({ pits });
}
