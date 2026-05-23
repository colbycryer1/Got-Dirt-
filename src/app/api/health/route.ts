import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ db: "ok", env: {
      hasDbUrl: !!process.env.DATABASE_URL,
      hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
      hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
      hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
      nextAuthUrl: process.env.NEXTAUTH_URL,
    }});
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ db: "error", error: message }, { status: 500 });
  }
}
