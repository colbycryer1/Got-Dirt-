import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signMobileJWT } from "@/lib/mobile-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { UserRole } from "@prisma/client";

const schema = z.object({
  email:    z.string().email(),
  password: z.string().min(8),
  name:     z.string().min(1).max(100).optional(),
  role:     z.enum(["BUYER", "PIT_OWNER", "DRIVER"]),
  company:  z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { email, password, name, role, company } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return NextResponse.json({ error: "Email already registered" }, { status: 409 });

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email:          email.toLowerCase(),
      hashedPassword,
      name:           name ?? null,
      role:           role as UserRole,
      company:        company ?? null,
    },
  });

  const token = await signMobileJWT({ id: user.id, email: user.email, role: user.role, name: user.name });

  return NextResponse.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, company: user.company },
  }, { status: 201 });
}
