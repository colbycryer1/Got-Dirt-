import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { exchangeProcoreCode, getProcoreMe, getProcoreCompanies } from "@/lib/integrations/procore";
import { encrypt } from "@/lib/encrypt";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/buyer/settings?error=unauthenticated`
    );

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  if (!code)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/buyer/settings?error=no_code`
    );

  try {
    const tokens = await exchangeProcoreCode(code);
    const [me, companies] = await Promise.all([
      getProcoreMe(tokens.access_token),
      getProcoreCompanies(tokens.access_token),
    ]);
    const company = companies[0];

    await prisma.integrationConnection.upsert({
      where: { buyerUserId_platform: { buyerUserId: session.user.id, platform: "PROCORE" } },
      create: {
        buyerUserId: session.user.id,
        platform: "PROCORE",
        accessTokenEnc: encrypt(tokens.access_token),
        refreshTokenEnc: encrypt(tokens.refresh_token),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        platformUserId: String(me.id),
        platformCompanyId: company ? String(company.id) : undefined,
        scope: "data:read data:write",
      },
      update: {
        accessTokenEnc: encrypt(tokens.access_token),
        refreshTokenEnc: encrypt(tokens.refresh_token),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        platformUserId: String(me.id),
        platformCompanyId: company ? String(company.id) : undefined,
        lastSyncError: null,
      },
    });

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/buyer/settings?connected=procore`
    );
  } catch (err) {
    console.error("[procore/callback]", err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/buyer/settings?error=procore_failed`
    );
  }
}
