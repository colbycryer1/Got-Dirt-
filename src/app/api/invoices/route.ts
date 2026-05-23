import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: userId, role } = session.user;

  const invoices = await prisma.invoice.findMany({
    where:
      role === UserRole.ADMIN
        ? {}
        : role === UserRole.PIT_OWNER
        ? { transaction: { pit: { ownerId: userId } } }
        : { transaction: { contractorId: userId } },
    include: {
      transaction: {
        include: {
          pit: { select: { name: true, state: true } },
          contractor: { select: { name: true, email: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ invoices });
}
