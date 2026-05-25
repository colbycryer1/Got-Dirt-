/** Returns the canonical app origin, preferring NEXTAUTH_URL since it must
 *  already be set correctly for auth to work (avoids stale NEXT_PUBLIC_APP_URL). */
export function appUrl(): string {
  return (process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
    .replace(/\/$/, "");
}
