import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  name:        z.string().min(1).optional(),
  location:    z.string().min(1).optional(),
  description: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await prisma.project.findUnique({
    where:  { id: params.id },
    select: { buyerUserId: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (session.user.role !== "ADMIN" && project.buyerUserId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await prisma.project.update({
    where: { id: params.id },
    data: {
      ...(parsed.data.name        !== undefined && { name:        parsed.data.name }),
      ...(parsed.data.location    !== undefined && { location:    parsed.data.location }),
      ...(parsed.data.description !== undefined && { description: parsed.data.description }),
    },
  });

  return NextResponse.json({ project: updated });
}
