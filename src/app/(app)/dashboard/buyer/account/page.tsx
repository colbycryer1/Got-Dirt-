import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import AccountForm from "./AccountForm";

export const metadata = { title: "My Account — Got Dirt?" };

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { name: true, email: true, company: true, phone: true, role: true, createdAt: true },
  });
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/buyer" className="text-amber-600 hover:text-amber-700 text-sm font-medium">
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
      </div>
    </div>
  );
}
