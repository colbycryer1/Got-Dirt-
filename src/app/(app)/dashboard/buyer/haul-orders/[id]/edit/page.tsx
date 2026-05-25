import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isBuyerRole } from "@/types";
import EditHaulOrderForm from "./EditHaulOrderForm";

export const metadata = { title: "Edit Haul Order — Got Dirt?" };

export default async function EditHaulOrderPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!isBuyerRole(session.user.role) && session.user.role !== "ADMIN") redirect("/dashboard");

  const order = await prisma.haulOrder.findUnique({
    where:  { id: params.id },
    select: {
      id:            true,
      buyerUserId:   true,
      status:        true,
      scheduledDate: true,
      loads:         true,
      notes:         true,
      haulRateCents: true,
      pit:           { select: { name: true, state: true } },
    },
  });

  if (!order) notFound();
  if (order.buyerUserId !== session.user.id && session.user.role !== "ADMIN") notFound();
  if (!["PENDING", "CONFIRMED"].includes(order.status)) redirect("/dashboard/buyer/haul-orders");
  if (order.scheduledDate < new Date()) redirect("/dashboard/buyer/haul-orders");

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/buyer/haul-orders" className="text-amber-600 hover:text-amber-700 text-sm font-medium">
          ← Haul Orders
        </Link>
        <span className="text-gray-300">|</span>
        <Link href="/" className="font-black text-black text-lg">Got Dirt?</Link>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Haul Order</h1>
          {order.pit && (
            <p className="text-gray-500 mt-0.5 text-sm">{order.pit.name} · {order.pit.state}</p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <EditHaulOrderForm
            orderId={order.id}
            status={order.status}
            scheduledDate={order.scheduledDate.toISOString()}
            loads={order.loads}
            notes={order.notes}
            haulRateCents={order.haulRateCents}
            isConfirmed={order.status === "CONFIRMED"}
          />
        </div>
      </div>
    </div>
  );
}
