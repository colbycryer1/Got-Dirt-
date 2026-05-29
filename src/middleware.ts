import { withAuth, NextRequestWithAuth } from "next-auth/middleware";
import { NextResponse, NextFetchEvent, NextRequest } from "next/server";
import { UserRole } from "@prisma/client";

const CANONICAL_HOSTS = new Set(["gotdirt.us", "www.gotdirt.us"]);

const authMiddleware = withAuth(
  function middleware(req: NextRequestWithAuth) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    // Admin routes
    if (pathname.startsWith("/dashboard/admin")) {
      if (token?.role !== UserRole.ADMIN) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    // Pit owner routes
    if (pathname.startsWith("/dashboard/pit-owner")) {
      if (token?.role !== UserRole.PIT_OWNER && token?.role !== UserRole.ADMIN) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    // Buyer dashboard routes — BUYER, CARRIER, DRIVER (account only), and legacy CONTRACTOR
    if (pathname.startsWith("/dashboard/buyer")) {
      const isBuyer =
        token?.role === "BUYER" ||
        token?.role === "CARRIER" ||
        token?.role === UserRole.CONTRACTOR;
      // Drivers can access their account page via the buyer route
      const isDriverAccountAccess = token?.role === "DRIVER" && pathname === "/dashboard/buyer/account";
      if (!isBuyer && !isDriverAccountAccess && token?.role !== UserRole.ADMIN) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    // Driver dashboard routes
    if (pathname.startsWith("/dashboard/driver")) {
      if (token?.role !== "DRIVER" && token?.role !== UserRole.ADMIN) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    // Operator routes — pit owners and admins
    if (pathname.startsWith("/operator")) {
      if (token?.role !== UserRole.PIT_OWNER && token?.role !== UserRole.ADMIN) {
        return NextResponse.redirect(new URL("/login", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized({ token, req }) {
        const { pathname } = req.nextUrl;

        // Public paths — no auth required
        const publicPaths = ["/", "/map", "/login", "/register"];
        if (publicPaths.some((p) => pathname === p)) return true;

        // Pit detail pages are public
        if (pathname.startsWith("/pit/")) {
          const isPay = pathname.endsWith("/pay");
          if (!isPay) return true;
        }

        // API routes for reading pits are public
        if (pathname === "/api/pits" && req.method === "GET") return true;
        if (pathname.startsWith("/api/pits/") && req.method === "GET") return true;
        if (pathname === "/api/settings" && req.method === "GET") return true;
        if (pathname.startsWith("/api/payments/webhook")) return true;
        if (pathname.startsWith("/api/cron/")) return true; // protected by CRON_SECRET header, not auth

        // Everything else requires a session token
        return !!token;
      },
    },
  }
);

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  // In production, redirect any non-canonical host to www.gotdirt.us.
  // This blocks *.vercel.app preview URLs and any other domain aliases.
  if (process.env.NODE_ENV === "production") {
    const host = (req.headers.get("host") ?? "").split(":")[0];
    if (!CANONICAL_HOSTS.has(host)) {
      const url = req.nextUrl.clone();
      url.protocol = "https:";
      url.host = "www.gotdirt.us";
      return NextResponse.redirect(url, { status: 301 });
    }
  }

  return authMiddleware(req as NextRequestWithAuth, event);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|images/).*)",
  ],
};
