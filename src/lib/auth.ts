import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { UserRole } from "@prisma/client";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email:    { label: "Email",    type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) return null;

        // Account exists but was created via Google OAuth (no password set)
        if (!user.hashedPassword) {
          throw new Error("OAuthAccountOnly");
        }

        const valid = await bcrypt.compare(credentials.password, user.hashedPassword);
        if (!valid) return null;

        return {
          id:              user.id,
          email:           user.email,
          name:            user.name,
          image:           user.image,
          role:            user.role,
          stripeAccountId: user.stripeAccountId ?? undefined,
          stripeOnboarded: user.stripeOnboarded,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user, trigger }) {
      // Always do a DB lookup when user is present (covers both credentials and OAuth sign-ins)
      // This guarantees the role and stripe fields are fresh regardless of provider
      if (user) {
        token.id = user.id;
        const dbUser = await prisma.user.findUnique({
          where:  { id: user.id },
          select: { role: true, stripeAccountId: true, stripeOnboarded: true },
        });
        if (dbUser) {
          token.role            = dbUser.role;
          token.stripeAccountId = dbUser.stripeAccountId ?? undefined;
          token.stripeOnboarded = dbUser.stripeOnboarded;
        }
      }

      // Also refresh when the session is explicitly updated (e.g. after onboarding role selection)
      if (trigger === "update") {
        const dbUser = await prisma.user.findUnique({
          where:  { id: token.id as string },
          select: { role: true, stripeAccountId: true, stripeOnboarded: true },
        });
        if (dbUser) {
          token.role            = dbUser.role;
          token.stripeAccountId = dbUser.stripeAccountId ?? undefined;
          token.stripeOnboarded = dbUser.stripeOnboarded;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id              = token.id as string;
        session.user.role            = token.role as UserRole;
        session.user.stripeAccountId = token.stripeAccountId as string | undefined;
        session.user.stripeOnboarded = token.stripeOnboarded as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    newUser: "/onboarding",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
