"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import Link from "next/link";
import { centsToDisplay, calculateTransaction, TransactionType } from "@/types";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface PitInfo {
  id: string;
  name: string;
  dumpRateCents: number | null;
  borrowRateCents: number | null;
  topsoilRateCents: number | null;
  hasTopsoil: boolean;
}

export default function PayPage({ params }: { params: { id: string } }) {
  const { status } = useSession();
  const router = useRouter();
  const [pit, setPit] = useState<PitInfo | null>(null);
  const [transactionType, setTransactionType] = useState<TransactionType>("DUMP");
  const [loads, setLoads] = useState(1);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [feePercent, setFeePercent] = useState(8);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    fetch(`/api/pits/${params.id}`).then((r) => r.json()).then((d) => setPit(d.pit));
    fetch("/api/settings").then((r) => r.json()).then((d) => setFeePercent(d.feePercent));
  }, [params.id]);

  if (!pit) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

  const rateMap: Record<TransactionType, number | null> = {
    DUMP: pit.dumpRateCents,
    BORROW: pit.borrowRateCents,
    TOPSOIL: pit.hasTopsoil ? pit.topsoilRateCents : null,
  };

  const ratePerLoad = rateMap[transactionType];
  const calc = ratePerLoad ? calculateTransaction(ratePerLoad, loads, feePercent) : null;

  async function createIntent() {
    setCreating(true);
    setError("");
    const res = await fetch("/api/payments/create-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pitId: params.id, transactionType, loads }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to create payment");
      setCreating(false);
      return;
    }
    setClientSecret(data.clientSecret);
    setCreating(false);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href={`/pit/${params.id}`} className="text-green-600 text-sm font-medium">← Back</Link>
        <span className="font-bold text-green-700 text-lg">Got Dirt</span>
      </nav>

      <div className="max-w-lg mx-auto px-6 py-10 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Pay for {pit.name}</h1>
          <p className="text-gray-500 text-sm mb-6">Select transaction type and number of loads.</p>

          {/* Transaction type */}
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 block mb-2">Transaction Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(["DUMP", "BORROW", "TOPSOIL"] as TransactionType[]).map((t) => {
                const rate = rateMap[t];
                if (!rate) return null;
                return (
                  <button
                    key={t}
                    onClick={() => setTransactionType(t)}
                    className={`py-2 px-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                      transactionType === t
                        ? "border-green-500 bg-green-50 text-green-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {t === "DUMP" ? "Dump" : t === "BORROW" ? "Borrow" : "Topsoil"}
                    <div className="text-xs font-normal mt-0.5">{centsToDisplay(rate)}/load</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Loads */}
          <div className="mb-6">
            <label className="text-sm font-medium text-gray-700 block mb-2">
              Number of Loads: <span className="text-green-700 font-bold">{loads}</span>
            </label>
            <input
              type="number"
              min={1}
              max={1000}
              value={loads}
              onChange={(e) => setLoads(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Breakdown */}
          {calc && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm mb-6">
              <div className="flex justify-between text-gray-600">
                <span>{loads} load{loads > 1 ? "s" : ""} × {centsToDisplay(calc.ratePerLoadCents)}</span>
                <span>{centsToDisplay(calc.subtotalCents)}</span>
              </div>
              <div className="flex justify-between text-gray-400 text-xs">
                <span>Platform fee ({feePercent}%)</span>
                <span>{centsToDisplay(calc.platformFeeCents)}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-gray-900">
                <span>Total</span>
                <span>{centsToDisplay(calc.totalChargeCents)}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Pit owner receives {centsToDisplay(calc.ownerPayoutCents)} after the {feePercent}% platform fee.
              </p>
            </div>
          )}

          {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">{error}</div>}

          {!clientSecret && (
            <button
              disabled={creating || !ratePerLoad}
              onClick={createIntent}
              className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {creating ? "Setting up payment…" : `Pay ${calc ? centsToDisplay(calc.totalChargeCents) : ""}`}
            </button>
          )}
        </div>

        {clientSecret && (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <CheckoutForm />
          </Elements>
        )}
      </div>
    </div>
  );
}

function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setError("");

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${appUrl}/dashboard/contractor` },
    });

    if (error) {
      setError(error.message ?? "Payment failed");
      setProcessing(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <h2 className="font-semibold text-gray-900 mb-4">Card Details</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <PaymentElement />
        {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}
        <button
          type="submit"
          disabled={processing || !stripe}
          className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {processing ? "Processing…" : "Confirm Payment"}
        </button>
      </form>
    </div>
  );
}
