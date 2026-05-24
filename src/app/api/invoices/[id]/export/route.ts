import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const format = req.nextUrl.searchParams.get("format") ?? "json";

  const settlement = await prisma.settlement.findUnique({
    where: { id: params.id },
    include: {
      order: {
        include: {
          pit:     { select: { name: true, address: true, state: true } },
          buyer:   { select: { name: true, company: true, email: true } },
          project: { select: { name: true, externalJobCode: true, costCode: true, glAccountCode: true, qbAccount: true, qbClass: true } },
          loadEvents: {
            where: { verified: true, disputed: false },
            select: { materialType: true, rateCentsAtTime: true },
          },
        },
      },
    },
  });

  if (!settlement) return NextResponse.json({ error: "Settlement not found" }, { status: 404 });

  // Access control — only buyer, pit owner of that pit, or admin
  const order = settlement.order;
  const isAdmin = session.user.role === "ADMIN";
  const isBuyer = order.buyerUserId === session.user.id;
  if (!isAdmin && !isBuyer) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const dateStr = new Date(settlement.date).toLocaleDateString("en-US");
  const invoiceRef = `GD-${settlement.id.slice(0, 8).toUpperCase()}`;
  const primaryMaterial = order.loadEvents[0]?.materialType ?? "Mixed";
  const unitPriceCents  = order.loadEvents[0]?.rateCentsAtTime ?? 0;

  if (format === "json") {
    return NextResponse.json({
      invoiceNumber:   invoiceRef,
      date:            dateStr,
      pit:             order.pit.name,
      buyer:           order.buyer.company ?? order.buyer.name ?? order.buyer.email,
      project:         order.project.name,
      jobNumber:       order.project.externalJobCode,
      costCode:        order.project.costCode,
      glAccount:       order.project.glAccountCode,
      materialType:    primaryMaterial,
      loadCount:       settlement.verifiedLoadCount,
      unitPrice:       (unitPriceCents / 100).toFixed(2),
      gross:           (settlement.grossAmountCents / 100).toFixed(2),
      commission:      (settlement.commissionCents / 100).toFixed(2),
      netToPit:        (settlement.netToPitCents / 100).toFixed(2),
    });
  }

  if (format === "csv") {
    const rows = [
      ["Transaction Date", "Invoice Number", "Job Number", "Cost Code", "GL Account", "Description", "Quantity", "Unit", "Unit Cost", "Total Cost", "Tax Amount"],
      [
        dateStr,
        invoiceRef,
        order.project.externalJobCode ?? "",
        order.project.costCode ?? "",
        order.project.glAccountCode ?? "",
        `${order.pit.name} - ${primaryMaterial} - ${settlement.verifiedLoadCount} loads`,
        String(settlement.verifiedLoadCount),
        "LOAD",
        (unitPriceCents / 100).toFixed(2),
        (settlement.grossAmountCents / 100).toFixed(2),
        "0.00",
      ],
    ];

    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="GotDirt_Invoice_${invoiceRef}.csv"`,
      },
    });
  }

  if (format === "pdf") {
    // Dynamically import to keep server bundle lean
    const { generateInvoicePDF } = await import("@/lib/pdf");
    const pdfBuffer = await generateInvoicePDF({
      invoiceRef,
      dateStr,
      pitName:    order.pit.name,
      pitAddress: order.pit.address ?? "",
      buyerName:  order.buyer.company ?? order.buyer.name ?? order.buyer.email,
      projectName: order.project.name,
      jobNumber:   order.project.externalJobCode ?? "",
      materialType: primaryMaterial,
      loadCount:   settlement.verifiedLoadCount,
      unitPriceCents,
      grossCents:  settlement.grossAmountCents,
      commissionCents: settlement.commissionCents,
      netToPitCents:   settlement.netToPitCents,
    });

    return new Response(pdfBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="GotDirt_Invoice_${invoiceRef}.pdf"`,
      },
    });
  }

  return NextResponse.json({ error: "Unsupported format. Use: json, csv, pdf" }, { status: 400 });
}
