import { SignJWT, jwtVerify } from "jose";
import { NextRequest } from "next/server";

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? "fallback-dev-secret");

export async function signMobileJWT(payload: { id: string; email: string; role: string; name: string | null }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

export async function verifyMobileJWT(token: string) {
  const { payload } = await jwtVerify(token, secret);
  return payload as { id: string; email: string; role: string; name: string | null };
}

export function getMobileToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}
