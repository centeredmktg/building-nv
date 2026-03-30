import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import NewReviewForm from "./NewReviewForm";

export const dynamic = "force-dynamic";

export default async function NewReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sub = await prisma.subcontractorProfile.findUnique({
    where: { id },
    include: { company: { select: { name: true } } },
  });
  if (!sub) notFound();

  const projects = await prisma.project.findMany({
    where: { stage: { in: ["active", "punch_list", "complete"] } },
    select: { id: true, name: true },
    orderBy: { updatedAt: "desc" },
  });

  const reviewers = await prisma.contact.findMany({
    where: { type: "employee" },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { firstName: "asc" },
  });

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-text-primary mb-2">Add Review</h1>
      <p className="text-text-muted text-sm mb-6">for {sub.company.name}</p>
      <NewReviewForm subId={id} projects={projects} reviewers={reviewers} />
    </div>
  );
}
