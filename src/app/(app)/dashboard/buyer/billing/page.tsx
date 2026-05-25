"use client";

import { useEffect, useState, useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import Link from "next/link";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface CardInfo {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

function BillingInner() {
  const stripe    = useStripe();
  const elements  = useElements();

  const [card,       setCard]       = useState<CardInfo | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error,      setError]      = useState("");
  const [success,    setSuccess]    = useState(false);

  const fetchStatus = useCallback(async () => {
    const res  = await fetch("/api/stripe/customer");
    const data = await res.json();
    setCard(data.card ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  async function startSetup() {
    setError("");
    const res  = await fetch("/api/stripe/customer", { method: "POST" });
    const data = await res.json();
    setClientSecret(data.clientSecret ?? null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || !clientSecret) return;
    setSaving(true);
    setError("");

    const cardEl = elements.getElement(CardElement);
    if (!cardEl) { setSaving(false); return; }

    const { setupIntent, error: stripeErr } = await stripe.confirmCardSetup(clientSecret, {
      payment_method: { card: cardEl },
    });

    if (stripeErr) {
      setError(stripeErr.message ?? "Card setup failed");
      setSaving(false);
      return;
    }

    if (setupIntent?.id) {
      const res = await fetch("/api/stripe/customer", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ setupIntentId: setupIntent.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setCard(data.card);
        setClientSecret(null);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 4000);
      } else {
        setError(data.error ?? "Failed to save card");
      }
    }
    setSaving(false);
  }

  const brandLabel = (b: string) => b.charAt(0).toUpperCase() + b.slice(1);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/buyer" className="text-amber-600 hover:text-amber-700 text-sm font-medium">← Dashboard</Link>
        <span className="text-gray-300">|</span>
        <Link href="/" className="font-black text-black text-lg">Got Dirt?</Link>
      </nav>

      <div className="max-w-lg mx-auto px-6 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Method</h1>
          <p className="text-sm text-gray-500 mt-1">
            Your card is charged each evening for loads logged that day.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
            {/* Current card */}
            {card ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-7 bg-gray-100 rounded flex items-center justify-center text-xs font-bold text-gray-600 uppercase">
                    {card.brand.slice(0, 4)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{brandLabel(card.brand)} •••• {card.last4}</p>
                    <p className="text-xs text-gray-400">Expires {card.expMonth}/{card.expYear}</p>
                  </div>
                </div>
                <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-semibold">Active</span>
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <span className="text-amber-500 text-xl">⚠️</span>
                <div>
                  <p className="text-sm font-semibold text-amber-800">No payment method on file</p>
                  <p className="text-xs text-amber-700 mt-0.5">Add a card below to enable daily COB billing for loads.</p>
                </div>
              </div>
            )}

            {success && (
              <p className="text-sm text-green-600 font-medium">✓ Card saved successfully.</p>
            )}

            {/* Add / update card */}
            {!clientSecret ? (
              <button
                onClick={startSetup}
                className="w-full bg-amber-600 text-white font-semibold py-3 rounded-xl hover:bg-amber-700 transition-colors text-sm"
              >
                {card ? "Update Card" : "Add Card"}
              </button>
            ) : (
              <form onSubmit={handleSave} className="space-y-4">
                <div className="border border-gray-200 rounded-xl px-4 py-3">
                  <CardElement
                    options={{
                      style: {
                        base: { fontSize: "14px", color: "#111827", "::placeholder": { color: "#9ca3af" } },
                        invalid: { color: "#dc2626" },
                      },
                    }}
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={saving || !stripe}
                    className="flex-1 bg-amber-600 text-white font-semibold py-2.5 rounded-xl hover:bg-amber-700 disabled:opacity-50 transition-colors text-sm"
                  >
                    {saving ? "Saving…" : "Save Card"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setClientSecret(null); setError(""); }}
                    className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        <div className="text-xs text-gray-400 space-y-1">
          <p>Your card is charged each day at close of business for verified loads that day.</p>
          <p>Got Dirt? never stores your card details — they are securely handled by Stripe.</p>
        </div>
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Elements stripe={stripePromise}>
      <BillingInner />
    </Elements>
  );
}
