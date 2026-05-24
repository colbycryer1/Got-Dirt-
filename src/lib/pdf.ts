import { renderToBuffer, Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import React from "react";

Font.register({
  family: "Helvetica",
  fonts: [{ src: "Helvetica" }, { src: "Helvetica-Bold", fontWeight: "bold" }],
});

const styles = StyleSheet.create({
  page:      { fontFamily: "Helvetica", fontSize: 10, padding: 40, color: "#1f2937" },
  header:    { flexDirection: "row", justifyContent: "space-between", marginBottom: 28 },
  logo:      { fontSize: 18, fontWeight: "bold", color: "#000" },
  invoiceNo: { fontSize: 12, fontWeight: "bold", color: "#374151" },
  section:   { marginBottom: 16 },
  label:     { fontSize: 8, color: "#6b7280", textTransform: "uppercase", marginBottom: 2 },
  value:     { fontSize: 10, color: "#111827" },
  grid2:     { flexDirection: "row", gap: 24 },
  col:       { flex: 1 },
  divider:   { borderBottom: "1px solid #e5e7eb", marginVertical: 12 },
  table:     { borderTop: "1px solid #e5e7eb", marginTop: 8 },
  th:        { flexDirection: "row", backgroundColor: "#f9fafb", padding: "6 8", borderBottom: "1px solid #e5e7eb" },
  tr:        { flexDirection: "row", padding: "6 8", borderBottom: "1px solid #f3f4f6" },
  col1:      { flex: 3 },
  col2:      { flex: 1, textAlign: "right" },
  totalRow:  { flexDirection: "row", padding: "6 8", justifyContent: "space-between" },
  totalLabel: { fontWeight: "bold" },
  small:     { fontSize: 8, color: "#9ca3af", marginTop: 24 },
});

export interface InvoicePDFData {
  invoiceRef:      string;
  dateStr:         string;
  pitName:         string;
  pitAddress:      string;
  buyerName:       string;
  projectName:     string;
  jobNumber:       string;
  materialType:    string;
  loadCount:       number;
  unitPriceCents:  number;
  grossCents:      number;
  commissionCents: number;
  netToPitCents:   number;
}

function InvoiceDocument({ d }: { d: InvoicePDFData }) {
  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "LETTER", style: styles.page },
      // Header
      React.createElement(View, { style: styles.header },
        React.createElement(View, null,
          React.createElement(Text, { style: styles.logo }, "Got Dirt?"),
          React.createElement(Text, { style: { fontSize: 8, color: "#6b7280", marginTop: 2 } }, "Got Dirt LLC · gotdirt.com"),
        ),
        React.createElement(View, { style: { alignItems: "flex-end" } },
          React.createElement(Text, { style: styles.invoiceNo }, `Invoice ${d.invoiceRef}`),
          React.createElement(Text, { style: { fontSize: 9, color: "#6b7280", marginTop: 2 } }, d.dateStr),
        ),
      ),
      // Bill to / Pit
      React.createElement(View, { style: styles.grid2 },
        React.createElement(View, { style: styles.col },
          React.createElement(Text, { style: styles.label }, "Bill To"),
          React.createElement(Text, { style: styles.value }, d.buyerName),
          React.createElement(Text, { style: { ...styles.value, color: "#6b7280", fontSize: 9 } }, d.projectName),
          d.jobNumber && React.createElement(Text, { style: { fontSize: 9, color: "#6b7280" } }, `Job # ${d.jobNumber}`),
        ),
        React.createElement(View, { style: styles.col },
          React.createElement(Text, { style: styles.label }, "Pit / Supplier"),
          React.createElement(Text, { style: styles.value }, d.pitName),
          d.pitAddress && React.createElement(Text, { style: { fontSize: 9, color: "#6b7280" } }, d.pitAddress),
        ),
      ),
      React.createElement(View, { style: styles.divider }),
      // Line items table
      React.createElement(View, { style: styles.table },
        React.createElement(View, { style: styles.th },
          React.createElement(Text, { style: { ...styles.col1, fontSize: 8, color: "#6b7280" } }, "DESCRIPTION"),
          React.createElement(Text, { style: { ...styles.col2, fontSize: 8, color: "#6b7280" } }, "QTY"),
          React.createElement(Text, { style: { ...styles.col2, fontSize: 8, color: "#6b7280" } }, "UNIT PRICE"),
          React.createElement(Text, { style: { ...styles.col2, fontSize: 8, color: "#6b7280" } }, "AMOUNT"),
        ),
        React.createElement(View, { style: styles.tr },
          React.createElement(Text, { style: styles.col1 }, `${d.materialType} — verified loads`),
          React.createElement(Text, { style: styles.col2 }, String(d.loadCount)),
          React.createElement(Text, { style: styles.col2 }, fmt(d.unitPriceCents)),
          React.createElement(Text, { style: styles.col2 }, fmt(d.grossCents)),
        ),
      ),
      React.createElement(View, { style: styles.divider }),
      // Totals
      React.createElement(View, { style: styles.totalRow },
        React.createElement(Text, { style: { color: "#6b7280" } }, "Subtotal"),
        React.createElement(Text, null, fmt(d.grossCents)),
      ),
      React.createElement(View, { style: styles.totalRow },
        React.createElement(Text, { style: { color: "#6b7280" } }, "Platform Commission (8%)"),
        React.createElement(Text, { style: { color: "#6b7280" } }, fmt(d.commissionCents)),
      ),
      React.createElement(View, { style: { ...styles.totalRow, borderTop: "2px solid #111827", marginTop: 4, paddingTop: 8 } },
        React.createElement(Text, { style: styles.totalLabel }, "Total Charged"),
        React.createElement(Text, { style: styles.totalLabel }, fmt(d.grossCents)),
      ),
      // Footer
      React.createElement(Text, { style: styles.small },
        "Payment processed by Got Dirt LLC via Stripe. Got Dirt LLC is a payment intermediary and is not the seller of record. " +
        "The pit owner is the seller of record for all materials. Net payout to pit owner: " + fmt(d.netToPitCents) + "."
      ),
    )
  );
}

export async function generateInvoicePDF(data: InvoicePDFData): Promise<Buffer> {
  const doc = React.createElement(InvoiceDocument, { d: data });
  return renderToBuffer(doc as Parameters<typeof renderToBuffer>[0]);
}
