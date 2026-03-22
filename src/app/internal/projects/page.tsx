import { prisma } from "@/lib/prisma";
import KanbanBoard from "@/components/internal/KanbanBoard";
import { CRMProject, JobProject } from "@/lib/crmTypes";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    include: {
      projectContacts: { include: { contact: true } },
      projectCompanies: { include: { company: true } },
      milestones: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return <KanbanBoard initialProjects={projects as unknown as (CRMProject | JobProject)[]} />;
}
