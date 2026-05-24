import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signMobileJWT } from "@/lib/mobile-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  if (!user?.hashedPassword) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.hashedPassword);
  if (!valid) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

  const token = await signMobileJWT({ id: user.id, email: user.email, role: user.role, name: user.name });

  return NextResponse.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, company: user.company },
  });
}
