import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { z } from "zod";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isSelf = session.user.id === params.id;
  const isAdmin = session.user.role === UserRole.ADMIN;
  if (!isSelf && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true, email: true, name: true, image: true, role: true,
      phone: true, company: true, stripeOnboarded: true, createdAt: true,
    },
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ user });
}

// Roles a user can self-assign during onboarding
const SELF_ASSIGNABLE_ROLES: string[] = ["BUYER", "CARRIER", "DRIVER", "PIT_OWNER", "CONTRACTOR"];

const updateSchema = z.object({
  name:    z.string().optional(),
  phone:   z.string().optional(),
  company: z.string().optional(),
  role:    z.nativeEnum(UserRole).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isSelf = session.user.id === params.id;
  const isAdmin = session.user.role === UserRole.ADMIN;
  if (!isSelf && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Non-admins can only self-assign onboarding roles
  if (parsed.data.role && !isAdmin) {
    if (!SELF_ASSIGNABLE_ROLES.includes(parsed.data.role)) {
      delete parsed.data.role;
    }
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data: parsed.data,
    select: { id: true, email: true, name: true, role: true, phone: true, company: true },
  });

  return NextResponse.json({ user });
}
