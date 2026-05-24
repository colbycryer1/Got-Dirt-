import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: { id: string } };

// PATCH /api/admin/net-terms/invoices/[id]  { status: "PAID" | "WRITTEN_OFF" }
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { status } = await req.json() as { status: "PAID" | "WRITTEN_OFF" };
  if (!["PAID", "WRITTEN_OFF"].includes(status))
    return NextResponse.json({ error: "status must be PAID or WRITTEN_OFF" }, { status: 400 });

  const invoice = await prisma.netTermsInvoice.update({
    where: { id: params.id },
    data:  { status },
  });

  return NextResponse.json({ invoice });
}
