"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

// Initialised once at module level — recreating stripePromise on every render
// causes Elements to re-initialise and re-validate clientSecret, triggering
// "The string did not match the expected pattern" in @stripe/stripe-js v9+.
const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = pk ? loadStripe(pk) : null;

function DepositInner({ orderId }: { orderId: string }) {
  const stripe   = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError("");
    try {
      // redirect: 'if_required' — for non-redirect payment methods (cards), stripe.confirmPayment
      // returns {paymentIntent} instead of navigating; we then redirect manually.
      // This avoids a behavioral mismatch with allow_redirects:'never' on the PaymentIntent.
      const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/dashboard/buyer/haul-orders?deposited=${orderId}`,
        },
        redirect: "if_required",
      });
      if (stripeError) throw new Error(stripeError.message);
      if (paymentIntent) {
        window.location.href = `/dashboard/buyer/haul-orders?deposited=${orderId}`;
        return;
      }
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
        {submitting ? "Processing…" : "Authorize Payment Hold"}
      </button>
      <p className="text-xs text-gray-400 text-center">
        You are only charged for actual loads delivered. Unused funds are released automatically. The hold is cancelled if the order is cancelled.
      </p>
    </form>
  );
}

export default function HaulDepositForm({
  clientSecret,
  orderId,
}: {
  clientSecret: string;
  orderId: string;
}) {
  if (!stripePromise) {
    return (
      <p className="text-sm text-red-600">
        Payment configuration error. Please contact support.
      </p>
    );
  }
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
      <DepositInner orderId={orderId} />
    </Elements>
  );
}
