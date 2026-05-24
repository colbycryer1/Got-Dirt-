import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAccAuthUrl } from "@/lib/integrations/acc";
import { randomBytes } from "crypto";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const state = randomBytes(16).toString("hex");
  const url = getAccAuthUrl(state);
  return NextResponse.redirect(url);
}
