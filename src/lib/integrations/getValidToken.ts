import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/encrypt";
import { refreshProcoreToken } from "./procore";
import { refreshAccToken } from "./acc";
import type { IntegrationPlatform } from "@prisma/client";

/** Returns a valid (possibly auto-refreshed) access token for a connection. */
export async function getValidToken(
  buyerUserId: string,
  platform: IntegrationPlatform
): Promise<string> {
  const conn = await prisma.integrationConnection.findUniqueOrThrow({
    where: { buyerUserId_platform: { buyerUserId, platform } },
  });

  const needsRefresh =
    conn.expiresAt && conn.expiresAt.getTime() - Date.now() < 5 * 60 * 1000;

  if (!needsRefresh) return decrypt(conn.accessTokenEnc);

  if (!conn.refreshTokenEnc) throw new Error(`No refresh token for ${platform}`);
  const refreshToken = decrypt(conn.refreshTokenEnc);

  let newAccess: string;
  let newRefresh: string;
  let expiresIn: number;

  if (platform === "PROCORE") {
    const r = await refreshProcoreToken(refreshToken);
    newAccess = r.access_token;
    newRefresh = r.refresh_token;
    expiresIn = r.expires_in;
  } else if (platform === "ACC") {
    const r = await refreshAccToken(refreshToken);
    newAccess = r.access_token;
    newRefresh = r.refresh_token;
    expiresIn = r.expires_in;
  } else {
    throw new Error(`Auto-refresh not supported for ${platform}`);
  }

  await prisma.integrationConnection.update({
    where: { buyerUserId_platform: { buyerUserId, platform } },
    data: {
      accessTokenEnc: encrypt(newAccess),
      refreshTokenEnc: encrypt(newRefresh),
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    },
  });

  return newAccess;
}
