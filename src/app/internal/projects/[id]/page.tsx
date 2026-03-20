import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProjectSiteForm from "./ProjectSiteForm";
import TeamAssignmentPanel from "./TeamAssignmentPanel";
import FinancialSummarySection from "@/components/internal/FinancialSummarySection";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [project, allEmployees] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      include: {
        projectContacts: { include: { contact: true } },
        quotes: { select: { id: true, title: true, status: true, address: true } },
        teamMembers: {
          include: {
            employee: {
              include: {
                contact: { select: { firstName: true, lastName: true, phone: true } },
                certifications: { select: { type: true, verifiedStatus: true } },
              },
            },
          },
        },
      },
    }),
    prisma.employee.findMany({
      where: { activeStatus: "active" },
      include: { contact: { select: { firstName: true, lastName: true, phone: true } } },
      orderBy: { legalName: "asc" },
    }),
  ]);

  if (!project) notFound();

  const siteAddress = project.siteAddress
    ? `${project.siteAddress}, ${project.siteCity}, ${project.siteState} ${project.siteZip}`
    : null;

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <Link href="/internal/projects" className="text-text-muted text-sm hover:text-text-primary mb-2 inline-block">
            ← Pipeline
          </Link>
          <h1 className="text-2xl font-bold text-text-primary">{project.name}</h1>
          <p className="text-text-muted text-sm mt-1 capitalize">{project.stage.replace(/_/g, " ")}</p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/internal/projects/${id}/safety-plan`}
            className="bg-accent text-bg font-semibold px-4 py-2 rounded-sm text-sm hover:bg-accent/90 transition-colors"
          >
            Safety Plan
          </Link>
          <Link
            href={`/internal/projects/${id}/binder/print`}
            target="_blank"
            className="border border-border text-text-muted px-4 py-2 rounded-sm text-sm hover:text-text-primary transition-colors"
          >
            Print Binder
          </Link>
        </div>
      </div>

      {/* Site information */}
      <section className="border border-border rounded-sm p-6 mb-6">
        <h2 className="text-text-primary font-semibold mb-4">Site Information</h2>
        {siteAddress && (
          <p className="text-text-muted text-sm mb-4">{siteAddress}</p>
        )}
        <ProjectSiteForm
          projectId={id}
          initial={{
            siteAddress: project.siteAddress,
            siteCity: project.siteCity,
            siteState: project.siteState,
            siteZip: project.siteZip,
            hazardNotes: project.hazardNotes,
          }}
        />
      </section>

      {/* Financial Summary */}
      {["preconstruction", "active", "punch_list", "complete"].includes(project.stage) && (
        <section className="border border-border rounded-sm p-6 mb-6">
          <FinancialSummarySection
            projectId={project.id}
            initial={{
              contractAmount: project.contractAmount ?? null,
              targetCostAmount: project.targetCostAmount ?? null,
              estimatedStartDate: project.estimatedStartDate?.toISOString() ?? null,
              estimatedEndDate: project.estimatedEndDate?.toISOString() ?? null,
              timingNotes: project.timingNotes ?? null,
            }}
          />
        </section>
      )}

      {/* Team */}
      <section className="border border-border rounded-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-text-primary font-semibold">Job Site Team</h2>
          <Link
            href={`/internal/projects/${id}/phone-tree/print`}
            target="_blank"
            className="text-text-muted text-xs hover:text-text-primary transition-colors"
          >
            Print Phone Tree
          </Link>
        </div>
        <TeamAssignmentPanel
          projectId={id}
          initialMembers={project.teamMembers as Parameters<typeof TeamAssignmentPanel>[0]["initialMembers"]}
          availableEmployees={allEmployees}
        />
      </section>

      {/* Quotes */}
      {project.quotes.length > 0 && (
        <section className="border border-border rounded-sm p-6">
          <h2 className="text-text-primary font-semibold mb-4">Quotes</h2>
          <div className="flex flex-col gap-2">
            {project.quotes.map((q) => (
              <div key={q.id} className="flex items-center justify-between">
                <Link href={`/internal/quotes/${q.id}/edit`} className="text-accent text-sm hover:underline">
                  {q.title}
                </Link>
                <span className="text-text-muted text-xs capitalize">{q.status}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
