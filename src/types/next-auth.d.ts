import { UserRole } from "@prisma/client";
import { DefaultSession } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      stripeAccountId?: string;
      stripeOnboarded: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    stripeAccountId?: string;
    stripeOnboarded: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    role: UserRole;
    stripeAccountId?: string;
    stripeOnboarded: boolean;
  }
}
