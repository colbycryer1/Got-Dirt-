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

// ── Haul order emails ──────────────────────────────────────────────────────

export async function sendHaulOrderToPitOwner(opts: {
  ownerEmail:       string;
  ownerName:        string | null;
  pitName:          string;
  buyerCompany:     string | null;
  haulerName:       string | null;
  loads:            number;
  materialRateCents: number;
  scheduledDate:    string;
  orderId:          string;
}) {
  const { ownerEmail, ownerName, pitName, buyerCompany, haulerName, loads, materialRateCents, scheduledDate, orderId } = opts;
  const rateStr = `$${(materialRateCents / 100).toFixed(2)}/load`;
  const totalStr = `$${((materialRateCents * loads) / 100).toFixed(2)}`;
  await send(
    ownerEmail,
    `Got Dirt? — New haul order at ${pitName}`,
    `<p>Hi ${ownerName ?? "there"},</p>
     <p>A buyer has placed a haul order at <strong>${pitName}</strong> and needs your approval.</p>
     <ul>
       <li>Buyer: <strong>${buyerCompany ?? "Unknown buyer"}</strong></li>
       <li>Hauler: <strong>${haulerName ?? "Independent driver"}</strong></li>
       <li>Estimated loads: <strong>${loads}</strong></li>
       <li>Material rate: <strong>${rateStr}</strong></li>
       <li>Material total (est.): <strong>${totalStr}</strong></li>
       <li>Scheduled: <strong>${scheduledDate}</strong></li>
       <li>Order ID: <code>${orderId}</code></li>
     </ul>
     <p>Log in to Got Dirt? to <strong>approve or deny</strong> this order and start a load session when the driver arrives.</p>
     <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/pit-owner/active-orders">Review Order →</a></p>`
  );
}

export async function sendHaulCompletedToBuyer(opts: {
  buyerEmail:        string;
  buyerName:         string | null;
  haulerName:        string | null;
  pitName:           string;
  actualLoads:       number;
  haulRateCents:     number;
  materialRateCents: number;
  totalCents:        number;
  orderId:           string;
}) {
  const { buyerEmail, buyerName, haulerName, pitName, actualLoads, haulRateCents, materialRateCents, totalCents, orderId } = opts;
  const haulTotal = actualLoads * haulRateCents;
  const matTotal  = actualLoads * materialRateCents;
  await send(
    buyerEmail,
    `Got Dirt? — Haul complete at ${pitName}`,
    `<p>Hi ${buyerName ?? "there"},</p>
     <p>Your haul order at <strong>${pitName}</strong> has been completed. Please review the load log and confirm below.</p>
     <ul>
       <li>Hauler: <strong>${haulerName ?? "—"}</strong></li>
       <li>Pit: <strong>${pitName}</strong></li>
       <li>Actual loads: <strong>${actualLoads}</strong></li>
       <li>Haul charge: <strong>$${(haulTotal / 100).toFixed(2)}</strong></li>
       ${matTotal > 0 ? `<li>Pit material: <strong>$${(matTotal / 100).toFixed(2)}</strong></li>` : ""}
       <li>Total: <strong>$${(totalCents / 100).toFixed(2)}</strong></li>
       <li>Order ID: <code>${orderId}</code></li>
     </ul>
     <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/buyer/haul-orders">Review & Confirm →</a></p>
     <p>Your card will be charged once you confirm. The hauler and pit will be paid within 2 business days of confirmation.</p>`
  );
}

export async function sendHaulPayoutToHauler(opts: {
  haulerEmail:   string;
  haulerName:    string | null;
  buyerCompany:  string | null;
  actualLoads:   number;
  payoutCents:   number;
  orderId:       string;
}) {
  const { haulerEmail, haulerName, buyerCompany, actualLoads, payoutCents, orderId } = opts;
  await send(
    haulerEmail,
    `Got Dirt? — Payout on its way`,
    `<p>Hi ${haulerName ?? "there"},</p>
     <p>A haul you completed has been settled by the buyer.</p>
     <ul>
       <li>Buyer: <strong>${buyerCompany ?? "—"}</strong></li>
       <li>Loads hauled: <strong>${actualLoads}</strong></li>
       <li>Your payout: <strong>$${(payoutCents / 100).toFixed(2)}</strong></li>
       <li>Order ID: <code>${orderId}</code></li>
     </ul>
     <p>Transfer typically arrives in 2 business days via Stripe Express. Thank you for hauling with Got Dirt?</p>`
  );
}

export async function sendHaulRequestToHauler(opts: {
  haulerEmail: string;
  haulerName: string | null;
  buyerCompany: string | null;
  loads: number;
  rateCents: number;
  scheduledDate: string;
  orderId: string;
  dashboardPath: string; // "/dashboard/driver/haul-orders" | "/dashboard/buyer/haul-orders"
}) {
  const { haulerEmail, haulerName, buyerCompany, loads, rateCents, scheduledDate, dashboardPath } = opts;
  const total = ((loads * rateCents) / 100).toFixed(2);
  await send(
    haulerEmail,
    `Got Dirt? — New haul request from ${buyerCompany ?? "a buyer"}`,
    `<p>Hi ${haulerName ?? "there"},</p>
     <p>You have a new haul request waiting for your response.</p>
     <ul>
       <li>From: <strong>${buyerCompany ?? "Unknown buyer"}</strong></li>
       <li>Loads: <strong>${loads}</strong></li>
       <li>Rate: <strong>$${(rateCents / 100).toFixed(2)}/load</strong></li>
       <li>Estimated total: <strong>$${total}</strong></li>
       <li>Scheduled: <strong>${scheduledDate}</strong></li>
     </ul>
     <p><a href="${process.env.NEXT_PUBLIC_APP_URL}${dashboardPath}">Confirm or Deny →</a></p>
     <p>This request may expire — respond promptly.</p>`
  );
}

export async function sendHaulBroadcast(opts: {
  haulerEmails: string[];
  buyerCompany: string | null;
  loads: number;
  rateCents: number;
  scheduledDate: string;
  expiresAt: string | null;
}) {
  const { haulerEmails, buyerCompany, loads, rateCents, scheduledDate, expiresAt } = opts;
  const total = ((loads * rateCents) / 100).toFixed(2);
  const subject = `Got Dirt? — Open haul job from ${buyerCompany ?? "a buyer"} (first-come-first-served)`;
  const html = `<p>A haul job is available — first to claim gets it.</p>
     <ul>
       <li>From: <strong>${buyerCompany ?? "Unknown buyer"}</strong></li>
       <li>Loads: <strong>${loads}</strong></li>
       <li>Rate: <strong>$${(rateCents / 100).toFixed(2)}/load</strong></li>
       <li>Estimated total: <strong>$${total}</strong></li>
       <li>Scheduled: <strong>${scheduledDate}</strong></li>
       ${expiresAt ? `<li>Expires: <strong>${expiresAt}</strong></li>` : ""}
     </ul>
     <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/driver/haul-orders">Claim this job →</a></p>`;
  await Promise.all(haulerEmails.map((email) => send(email, subject, html)));
}

export async function sendHaulConfirmedToBuyer(opts: {
  buyerEmail: string;
  buyerName: string | null;
  haulerName: string | null;
  loads: number;
  scheduledDate: string;
  orderId: string;
}) {
  const { buyerEmail, buyerName, haulerName, loads, scheduledDate, orderId } = opts;
  await send(
    buyerEmail,
    `Got Dirt? — Haul confirmed by ${haulerName ?? "your hauler"}`,
    `<p>Hi ${buyerName ?? "there"},</p>
     <p>Your haul request has been <strong>confirmed</strong>.</p>
     <ul>
       <li>Hauler: <strong>${haulerName ?? "—"}</strong></li>
       <li>Loads: <strong>${loads}</strong></li>
       <li>Scheduled: <strong>${scheduledDate}</strong></li>
       <li>Order ID: <code>${orderId}</code></li>
     </ul>
     <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/buyer/haul-orders">View Haul Orders →</a></p>`
  );
}

export async function sendHaulDeniedToBuyer(opts: {
  buyerEmail: string;
  buyerName: string | null;
  haulerName: string | null;
  scheduledDate: string;
}) {
  const { buyerEmail, buyerName, haulerName, scheduledDate } = opts;
  await send(
    buyerEmail,
    `Got Dirt? — Haul request declined`,
    `<p>Hi ${buyerName ?? "there"},</p>
     <p>Unfortunately, <strong>${haulerName ?? "the hauler"}</strong> has declined your haul request scheduled for <strong>${scheduledDate}</strong>.</p>
     <p>You can send a new request to another driver or carrier from the map or your haul orders page.</p>
     <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/buyer/haul-orders">View Haul Orders →</a></p>`
  );
}

export async function sendHaulClaimedToBuyer(opts: {
  buyerEmail: string;
  buyerName: string | null;
  haulerName: string | null;
  loads: number;
  scheduledDate: string;
  orderId: string;
}) {
  const { buyerEmail, buyerName, haulerName, loads, scheduledDate, orderId } = opts;
  await send(
    buyerEmail,
    `Got Dirt? — Your broadcast haul job was claimed`,
    `<p>Hi ${buyerName ?? "there"},</p>
     <p>Your open haul job has been claimed and is now confirmed.</p>
     <ul>
       <li>Hauler: <strong>${haulerName ?? "—"}</strong></li>
       <li>Loads: <strong>${loads}</strong></li>
       <li>Scheduled: <strong>${scheduledDate}</strong></li>
       <li>Order ID: <code>${orderId}</code></li>
     </ul>
     <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/buyer/haul-orders">View Haul Orders →</a></p>`
  );
}

export async function sendSessionEndedToBuyer(opts: {
  buyerEmail:       string;
  buyerName:        string | null;
  pitName:          string;
  haulerName:       string | null;
  actualLoads:      number;
  haulRateCents:    number;
  materialRateCents: number;
  orderId:          string;
}) {
  const { buyerEmail, buyerName, pitName, haulerName, actualLoads, haulRateCents, materialRateCents, orderId } = opts;
  const haulTotal = actualLoads * haulRateCents;
  const matTotal  = actualLoads * materialRateCents;
  const totalCents = haulTotal + matTotal;
  await send(
    buyerEmail,
    `Got Dirt? — Load session complete at ${pitName} — your review needed`,
    `<p>Hi ${buyerName ?? "there"},</p>
     <p>The pit operator at <strong>${pitName}</strong> has ended the load session for your haul order. Please review the load log and confirm to release payment.</p>
     <ul>
       <li>Hauler: <strong>${haulerName ?? "—"}</strong></li>
       <li>Pit: <strong>${pitName}</strong></li>
       <li>Loads logged by pit: <strong>${actualLoads}</strong></li>
       <li>Haul charge: <strong>$${(haulTotal / 100).toFixed(2)}</strong></li>
       ${matTotal > 0 ? `<li>Pit material: <strong>$${(matTotal / 100).toFixed(2)}</strong></li>` : ""}
       <li>Estimated total: <strong>$${(totalCents / 100).toFixed(2)}</strong></li>
       <li>Order ID: <code>${orderId}</code></li>
     </ul>
     <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/buyer/haul-orders" style="background:#d97706;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">Review &amp; Confirm →</a></p>
     <p style="color:#6b7280;font-size:12px;">Your payment will only be charged once you confirm the load count.</p>`
  );
}

export async function sendOverageApprovalRequest(opts: {
  buyerEmail:     string;
  buyerName:      string | null;
  pitName:        string;
  orderedLoads:   number;
  actualLoads:    number;
  overageLoads:   number;
  rateCents:      number;
  cobTimeStr:     string;
  orderId:        string;
}) {
  const { buyerEmail, buyerName, pitName, orderedLoads, actualLoads, overageLoads, rateCents, cobTimeStr, orderId } = opts;
  const overageCents = overageLoads * rateCents;
  const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;
  await send(
    buyerEmail,
    `Got Dirt? — Pit operator logged ${overageLoads} extra load${overageLoads !== 1 ? "s" : ""} — your approval needed`,
    `<p>Hi ${buyerName ?? "there"},</p>
     <p>The pit operator at <strong>${pitName}</strong> has ended the load session and logged more loads than your original order.</p>
     <ul>
       <li>Original order: <strong>${orderedLoads} load${orderedLoads !== 1 ? "s" : ""}</strong></li>
       <li>Pit operator count: <strong>${actualLoads} load${actualLoads !== 1 ? "s" : ""}</strong></li>
       <li>Extra loads: <strong>+${overageLoads}</strong> (${fmt(overageCents)} additional)</li>
     </ul>
     <p><strong>Please approve or dispute by ${cobTimeStr} (close of business) to avoid automatic billing at the original load count.</strong></p>
     <p>If you approve, you will be charged for all ${actualLoads} loads. If you dispute, you will only be charged for the original ${orderedLoads} loads.</p>
     <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/buyer/haul-orders" style="background:#d97706;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">Review &amp; Approve →</a></p>
     <p style="color:#6b7280;font-size:12px;">Order ID: ${orderId}</p>`
  );
}
