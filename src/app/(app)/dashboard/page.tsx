import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardRedirect() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  if (session.user.role === "ADMIN") redirect("/dashboard/admin");
  if (session.user.role === "PIT_OWNER") redirect("/dashboard/pit-owner/pits");
  if (session.user.role === "DRIVER") redirect("/dashboard/driver");
  // BUYER and legacy CONTRACTOR both go to buyer dashboard
  redirect("/dashboard/buyer");
}
