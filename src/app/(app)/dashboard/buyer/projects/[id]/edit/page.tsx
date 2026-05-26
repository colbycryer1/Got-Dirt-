import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EditProjectForm from "./EditProjectForm";

export const metadata = { title: "Edit Project — Got Dirt?" };

export default async function EditProjectPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const isBuyer = session.user.role === "BUYER" || session.user.role === "CARRIER" || session.user.role === "CONTRACTOR";
  if (!isBuyer && session.user.role !== "ADMIN") redirect("/dashboard");

  const project = await prisma.project.findUnique({
    where:  { id: params.id },
    select: { id: true, buyerUserId: true, name: true, location: true, description: true },
  });

  if (!project) notFound();
  if (session.user.role !== "ADMIN" && project.buyerUserId !== session.user.id) notFound();

  return <EditProjectForm project={project} />;
}
