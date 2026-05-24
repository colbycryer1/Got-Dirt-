import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { exchangeAccCode, getAccUserProfile, getAccHubs } from "@/lib/integrations/acc";
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
    const tokens = await exchangeAccCode(code);
    const [profile, hubs] = await Promise.all([
      getAccUserProfile(tokens.access_token),
      getAccHubs(tokens.access_token),
    ]);
    const hub = hubs.data?.[0];

    await prisma.integrationConnection.upsert({
      where: { buyerUserId_platform: { buyerUserId: session.user.id, platform: "ACC" } },
      create: {
        buyerUserId: session.user.id,
        platform: "ACC",
        accessTokenEnc: encrypt(tokens.access_token),
        refreshTokenEnc: encrypt(tokens.refresh_token),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        platformUserId: profile.userId,
        platformOrgId: hub?.id,
        scope: "data:read data:write",
      },
      update: {
        accessTokenEnc: encrypt(tokens.access_token),
        refreshTokenEnc: encrypt(tokens.refresh_token),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        platformUserId: profile.userId,
        platformOrgId: hub?.id,
        lastSyncError: null,
      },
    });

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/buyer/settings?connected=acc`
    );
  } catch (err) {
    console.error("[acc/callback]", err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/buyer/settings?error=acc_failed`
    );
  }
}
