import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardRedirect() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  if (session.user.role === "ADMIN") redirect("/dashboard/admin");
  if (session.user.role === "PIT_OWNER") redirect("/dashboard/pit-owner");
  redirect("/dashboard/contractor");
}
