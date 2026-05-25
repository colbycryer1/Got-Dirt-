import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// DELETE /api/admin/users/[id] — hard-delete a user account (admin only)
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Prevent deleting yourself
  if (params.id === session.user.id)
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });

  const target = await prisma.user.findUnique({
    where:  { id: params.id },
    select: { role: true },
  });
  if (!target)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Prevent deleting other admins
  if (target.role === "ADMIN")
    return NextResponse.json({ error: "Cannot delete another admin account" }, { status: 400 });

  await prisma.user.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
