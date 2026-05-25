import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardRedirect() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  if (session.user.role === "ADMIN")     redirect("/dashboard/admin");
  if (session.user.role === "PIT_OWNER") redirect("/dashboard/pit-owner");
  if (session.user.role === "DRIVER")    redirect("/dashboard/driver");
  if (session.user.role === "CARRIER")   redirect("/dashboard/carrier");
  // BUYER and legacy CONTRACTOR share the buyer dashboard
  redirect("/dashboard/buyer");
}
