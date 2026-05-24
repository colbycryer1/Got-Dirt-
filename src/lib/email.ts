import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = "Got Dirt? <noreply@gotdirt.com>";

async function send(to: string, subject: string, html: string) {
  if (!resend) return; // silently skip if not configured
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    console.error("[email] send failed:", err);
  }
}

export async function sendCOBSettledBuyer(opts: {
  buyerEmail: string;
  buyerName: string | null;
  pitName: string;
  date: string;
  loadCount: number;
  grossCents: number;
}) {
  const { buyerEmail, buyerName, pitName, date, loadCount, grossCents } = opts;
  const dollars = (grossCents / 100).toFixed(2);
  await send(
    buyerEmail,
    `Got Dirt? — Daily settlement ${date}: ${pitName}`,
    `<p>Hi ${buyerName ?? "there"},</p>
     <p>Your daily settlement for <strong>${pitName}</strong> on <strong>${date}</strong> has been processed.</p>
     <ul>
       <li>Verified loads: <strong>${loadCount}</strong></li>
       <li>Total charged: <strong>$${dollars}</strong></li>
     </ul>
     <p>Thank you for using Got Dirt?</p>`
  );
}

export async function sendPayoutSentPitOwner(opts: {
  ownerEmail: string;
  ownerName: string | null;
  pitName: string;
  date: string;
  loadCount: number;
  netCents: number;
}) {
  const { ownerEmail, ownerName, pitName, date, loadCount, netCents } = opts;
  const dollars = (netCents / 100).toFixed(2);
  await send(
    ownerEmail,
    `Got Dirt? — Payout sent for ${pitName} on ${date}`,
    `<p>Hi ${ownerName ?? "there"},</p>
     <p>Your payout for <strong>${pitName}</strong> on <strong>${date}</strong> is on its way.</p>
     <ul>
       <li>Verified loads: <strong>${loadCount}</strong></li>
       <li>Net payout: <strong>$${dollars}</strong></li>
     </ul>
     <p>Transfer typically arrives in 2 business days. Thank you for using Got Dirt?</p>`
  );
}

export async function sendEmail(opts: { to: string; subject: string; html: string }) {
  await send(opts.to, opts.subject, opts.html);
}

export async function sendOrderConfirmationBuyer(opts: {
  buyerEmail: string;
  buyerName: string | null;
  pitName: string;
  pitAddress: string | null;
  date: string;
  estimatedLoads: number | null;
  orderId: string;
}) {
  const { buyerEmail, buyerName, pitName, pitAddress, date, estimatedLoads, orderId } = opts;
  await send(
    buyerEmail,
    `Got Dirt? — Order confirmed at ${pitName}`,
    `<p>Hi ${buyerName ?? "there"},</p>
     <p>Your order at <strong>${pitName}</strong> has been confirmed.</p>
     <ul>
       <li>Location: <strong>${pitAddress ?? "—"}</strong></li>
       <li>Scheduled date: <strong>${date}</strong></li>
       ${estimatedLoads ? `<li>Estimated loads: <strong>${estimatedLoads}</strong></li>` : ""}
       <li>Order ID: <code>${orderId}</code></li>
     </ul>
     <p>The pit operator will begin logging loads on the day of your order. You will receive a daily settlement summary each evening.</p>
     <p>Thank you for using Got Dirt?</p>`
  );
}

export async function sendPaymentReceiptBuyer(opts: {
  buyerEmail: string;
  buyerName: string | null;
  pitName: string;
  amountCents: number;
  transactionId: string;
  invoiceNumber: string;
}) {
  const { buyerEmail, buyerName, pitName, amountCents, transactionId, invoiceNumber } = opts;
  const dollars = (amountCents / 100).toFixed(2);
  await send(
    buyerEmail,
    `Got Dirt? — Payment receipt ${invoiceNumber}`,
    `<p>Hi ${buyerName ?? "there"},</p>
     <p>Your payment for <strong>${pitName}</strong> has been processed successfully.</p>
     <ul>
       <li>Invoice: <strong>${invoiceNumber}</strong></li>
       <li>Amount charged: <strong>$${dollars}</strong></li>
       <li>Transaction ID: <code>${transactionId}</code></li>
     </ul>
     <p>You can download your invoice from the Got Dirt? dashboard under Invoices.</p>
     <p>Thank you for using Got Dirt?</p>`
  );
}

export async function sendPaymentReceivedPitOwner(opts: {
  ownerEmail: string;
  ownerName: string | null;
  pitName: string;
  payoutCents: number;
  invoiceNumber: string;
}) {
  const { ownerEmail, ownerName, pitName, payoutCents, invoiceNumber } = opts;
  const dollars = (payoutCents / 100).toFixed(2);
  await send(
    ownerEmail,
    `Got Dirt? — Payout initiated for ${pitName}`,
    `<p>Hi ${ownerName ?? "there"},</p>
     <p>A payment has been received for <strong>${pitName}</strong> and your payout is on its way.</p>
     <ul>
       <li>Invoice: <strong>${invoiceNumber}</strong></li>
       <li>Your payout: <strong>$${dollars}</strong></li>
     </ul>
     <p>Transfers typically arrive in 2 business days via Stripe Express. Thank you for using Got Dirt?</p>`
  );
}

export async function sendNewOrderPitOwner(opts: {
  ownerEmail: string;
  ownerName: string | null;
  pitName: string;
  buyerCompany: string | null;
  materialType: string;
  date: string;
}) {
  const { ownerEmail, ownerName, pitName, buyerCompany, materialType, date } = opts;
  await send(
    ownerEmail,
    `Got Dirt? — New order at ${pitName}`,
    `<p>Hi ${ownerName ?? "there"},</p>
     <p>A new order has been placed at <strong>${pitName}</strong>.</p>
     <ul>
       <li>Buyer: <strong>${buyerCompany ?? "Unknown"}</strong></li>
       <li>Material: <strong>${materialType}</strong></li>
       <li>Date: <strong>${date}</strong></li>
     </ul>
     <p>Log in to Got Dirt? to view the order and start logging loads.</p>`
  );
}
