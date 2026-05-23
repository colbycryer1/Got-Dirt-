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
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user?.hashedPassword) return null;

        const valid = await bcrypt.compare(
          credentials.password,
          user.hashedPassword
        );
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          stripeAccountId: user.stripeAccountId ?? undefined,
          stripeOnboarded: user.stripeOnboarded,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: UserRole }).role;
        token.stripeAccountId = (user as { stripeAccountId?: string }).stripeAccountId;
        token.stripeOnboarded = (user as { stripeOnboarded: boolean }).stripeOnboarded;
      }

      // Re-fetch on session update to pick up role/stripe changes
      if (trigger === "update") {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.stripeAccountId = dbUser.stripeAccountId ?? undefined;
          token.stripeOnboarded = dbUser.stripeOnboarded;
        }
      }

      // On every JWT refresh pull latest role/stripe status
      if (!user && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, stripeAccountId: true, stripeOnboarded: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.stripeAccountId = dbUser.stripeAccountId ?? undefined;
          token.stripeOnboarded = dbUser.stripeOnboarded;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
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
