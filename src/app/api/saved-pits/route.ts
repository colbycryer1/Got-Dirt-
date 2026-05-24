import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const saved = await prisma.savedPit.findMany({
    where: { userId: session.user.id },
    include: {
      pit: {
        select: {
          id: true, name: true, address: true, state: true,
          pitType: true, accepting: true,
          dumpRateCents: true, borrowRateCents: true,
          operatorProvided: true, equipmentProvided: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ saved });
}
