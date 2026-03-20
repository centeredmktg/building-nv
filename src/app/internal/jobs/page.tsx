import { prisma } from "@/lib/prisma";
import { JobProject } from "@/lib/crmTypes";
import JobsBoard from "@/components/internal/JobsBoard";

export const dynamic = "force-dynamic";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ includeComplete?: string }>;
}) {
  const { includeComplete } = await searchParams;
  const showComplete = includeComplete === "true";

  const stages = ["preconstruction", "active", "punch_list"];
  if (showComplete) stages.push("complete");

  const projects = await prisma.project.findMany({
    where: { stage: { in: stages } },
    include: {
      milestones: { orderBy: { position: "asc" } },
      projectContacts: { include: { contact: true } },
    },
  });

  // Sort: estimatedEndDate asc, null last
  const sorted = [...projects].sort((a, b) => {
    if (!a.estimatedEndDate && !b.estimatedEndDate) return 0;
    if (!a.estimatedEndDate) return 1;
    if (!b.estimatedEndDate) return -1;
    return new Date(a.estimatedEndDate).getTime() - new Date(b.estimatedEndDate).getTime();
  });

  return <JobsBoard projects={sorted as unknown as JobProject[]} showComplete={showComplete} />;
}
