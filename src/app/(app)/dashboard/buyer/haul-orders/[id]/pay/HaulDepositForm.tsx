"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

function DepositInner({ orderId }: { orderId: string }) {
  const stripe   = useStripe();
  const elements = useElements();
  const router   = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError("");
    try {
      const { error: stripeError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/dashboard/buyer/haul-orders?deposited=${orderId}`,
        },
      });
      if (stripeError) throw new Error(stripeError.message);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Payment failed. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting || !stripe}
        className="w-full bg-amber-600 text-white py-3 rounded-xl font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
      >
        {submitting ? "Processing…" : "Authorize Deposit Hold"}
      </button>
      <p className="text-xs text-gray-400 text-center">
        Your card will not be charged until the haul is completed. The hold will be released if the order is cancelled.
      </p>
    </form>
  );
}

export default function HaulDepositForm({
  clientSecret,
  orderId,
  publishableKey,
}: {
  clientSecret: string;
  orderId: string;
  publishableKey: string;
}) {
  const stripePromise = loadStripe(publishableKey);
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
      <DepositInner orderId={orderId} />
    </Elements>
  );
}
