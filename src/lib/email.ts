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
