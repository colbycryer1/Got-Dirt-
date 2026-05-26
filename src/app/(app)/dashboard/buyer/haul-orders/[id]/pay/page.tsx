import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import HaulDepositForm from "./HaulDepositForm";

export const metadata = { title: "Confirm Haul Deposit — Got Dirt?" };

export default async function HaulDepositPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { secret?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const order = await prisma.haulOrder.findUnique({
    where: { id: params.id },
    include: {
      driver:  { include: { user: { select: { name: true } } } },
      carrier: { select: { companyName: true, user: { select: { name: true } } } },
    },
  });
  if (!order || order.buyerUserId !== session.user.id) redirect("/dashboard/buyer/haul-orders");

  const clientSecret = searchParams.secret;
  if (!clientSecret) redirect(`/dashboard/buyer/haul-orders`);

  const haulerName = order.carrier?.companyName
    ?? order.carrier?.user.name
    ?? order.driver?.user.name
    ?? "Hauler";

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/buyer/haul-orders" className="text-amber-600 hover:text-amber-700 text-sm font-medium">← Cancel</Link>
        <span className="text-gray-300">|</span>
        <Link href="/" className="font-black text-black text-lg">Got Dirt?</Link>
      </nav>

      <div className="max-w-md mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Confirm Deposit Hold</h1>
        <p className="text-gray-500 mb-8">
          A temporary hold of <strong>${(order.depositHoldCents / 100).toFixed(2)}</strong> will be placed on your card.
          It is not charged until the haul is completed.
        </p>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Hauler</span>
            <span className="font-medium">{haulerName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Date</span>
            <span className="font-medium">{new Date(order.scheduledDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Loads</span>
            <span className="font-medium">{order.loads}</span>
          </div>
          <div className="flex justify-between border-t border-gray-100 pt-2">
            <span className="text-gray-500">Estimated Total</span>
            <span className="font-bold">${(order.totalEstimatedCents / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-amber-700">
            <span className="font-semibold">Deposit Hold Now</span>
            <span className="font-bold">${(order.depositHoldCents / 100).toFixed(2)}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <HaulDepositForm
            clientSecret={clientSecret}
            orderId={order.id}
          />
        </div>
      </div>
    </div>
  );
}
