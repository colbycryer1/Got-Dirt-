import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BUCKET_SIZE_CENTS = 500; // $5 buckets
const MIN_SAMPLE_SIZE   = 10;  // don't suggest until we have enough data

/**
 * GET /api/haul-orders/rate-suggestions
 * Returns market-rate suggestions for open broadcast haul orders based on
 * historical acceptance data collected by Got Dirt LLC.
 *
 * Query params: none required — future enhancement can filter by state/pitType.
 */
export async function GET() {
  // Only consider completed broadcast orders (accepted + finished = market-validated rate)
  const completedBroadcasts = await prisma.haulOrder.findMany({
    where:  { broadcast: true, status: "COMPLETED" },
    select: { haulRateCents: true },
  });

  if (completedBroadcasts.length < MIN_SAMPLE_SIZE) {
    return NextResponse.json({
      suggested:  null,
      marketMin:  null,
      marketMax:  null,
      sampleSize: completedBroadcasts.length,
      message:    "Not enough market data yet — suggestions will appear as more orders complete.",
    });
  }

  const rates = completedBroadcasts.map((o) => o.haulRateCents);

  // Group into $5 buckets and find the most common (highest acceptance volume) tier
  const buckets = new Map<number, number>();
  for (const r of rates) {
    const bucket = Math.floor(r / BUCKET_SIZE_CENTS) * BUCKET_SIZE_CENTS;
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }

  let topBucket    = 0;
  let topCount     = 0;
  buckets.forEach((count, bucket) => {
    if (count > topCount) { topBucket = bucket; topCount = count; }
  });

  const suggested = topBucket + BUCKET_SIZE_CENTS / 2; // midpoint of top bucket
  const sorted    = [...rates].sort((a, b) => a - b);
  const p25       = sorted[Math.floor(sorted.length * 0.25)];
  const p75       = sorted[Math.floor(sorted.length * 0.75)];

  return NextResponse.json({
    suggested,
    marketMin:  p25,
    marketMax:  p75,
    sampleSize: rates.length,
    message:    null,
  });
}
