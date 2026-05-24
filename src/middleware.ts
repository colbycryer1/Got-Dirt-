import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";

export default withAuth(
  function middleware(req) {
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

    // Buyer dashboard routes — BUYER, CARRIER, and legacy CONTRACTOR all use this dashboard
    if (pathname.startsWith("/dashboard/buyer")) {
      const isBuyer =
        token?.role === "BUYER" ||
        token?.role === "CARRIER" ||
        token?.role === UserRole.CONTRACTOR;
      if (!isBuyer && token?.role !== UserRole.ADMIN) {
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

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|images/).*)",
  ],
};
