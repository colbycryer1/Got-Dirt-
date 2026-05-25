import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import AccountForm from "../../buyer/account/AccountForm";

export const metadata = { title: "My Account — Got Dirt?" };

export default async function PitOwnerAccountPage() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "PIT_OWNER" && session.user.role !== "ADMIN")) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { name: true, email: true, company: true, phone: true, role: true, createdAt: true },
  });
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/pit-owner" className="text-amber-600 hover:text-amber-700 text-sm font-medium">
          ← Dashboard
        </Link>
        <span className="text-gray-300">|</span>
        <Link href="/" className="font-black text-black text-lg">Got Dirt?</Link>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">My Account</h1>

        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <AccountForm
            initial={{
              name:      user.name,
              email:     user.email,
              company:   user.company,
              phone:     user.phone,
              role:      user.role,
              createdAt: user.createdAt.toISOString(),
            }}
          />
        </div>

        <div className="mt-6 bg-white rounded-2xl border border-gray-200 p-8 space-y-3">
          <h2 className="text-base font-bold text-gray-900">Stripe Payouts</h2>
          <p className="text-sm text-gray-500">Connect your bank account to receive payouts for loads at your pit.</p>
          <Link
            href="/account/stripe"
            className="inline-block bg-amber-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-amber-700 transition-colors"
          >
            Manage Stripe Account →
          </Link>
        </div>
      </div>
    </div>
  );
}
