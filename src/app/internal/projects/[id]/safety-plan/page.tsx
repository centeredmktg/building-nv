import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import EmergencyInfoForm from "./EmergencyInfoForm";
import { getComplianceStatus, complianceBadgeClass, complianceBadgeLabel } from "@/lib/employees";

export const dynamic = "force-dynamic";

export default async function SafetyPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      teamMembers: {
        include: {
          employee: {
            include: {
              contact: { select: { firstName: true, lastName: true, phone: true } },
              certifications: true,
            },
          },
        },
      },
    },
  });

  if (!project) notFound();

  const superintendent = project.teamMembers.find((m) => m.role === "superintendent");
  const siteAddress = project.siteAddress
    ? `${project.siteAddress}, ${project.siteCity}, ${project.siteState} ${project.siteZip}`
    : null;

  const missingAddress = !project.siteAddress;
  const missingER = !project.nearestER;

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <Link href={`/internal/projects/${id}`} className="text-text-muted text-sm hover:text-text-primary mb-2 inline-block">
            ← {project.name}
          </Link>
          <h1 className="text-2xl font-bold text-text-primary">Safety Plan</h1>
        </div>
        <Link
          href={`/internal/projects/${id}/safety-plan/print`}
          target="_blank"
          className="bg-accent text-bg font-semibold px-4 py-2 rounded-sm text-sm hover:bg-accent/90 transition-colors"
        >
          Print
        </Link>
      </div>

      {/* Warnings */}
      {(missingAddress || missingER) && (
        <div className="border border-yellow-500/30 bg-yellow-500/5 rounded-sm p-4 mb-6">
          <p className="text-yellow-400 text-sm font-medium mb-1">Safety plan is incomplete</p>
          <ul className="text-yellow-400/80 text-sm list-disc list-inside">
            {missingAddress && <li>Site address is required — add it on the project page</li>}
            {missingER && <li>Nearest ER is required — fill in below</li>}
          </ul>
        </div>
      )}

      {/* Site details */}
      <section className="border border-border rounded-sm p-6 mb-6">
        <h2 className="text-text-primary font-semibold mb-2">Job Site</h2>
        {siteAddress ? (
          <p className="text-text-muted text-sm">{siteAddress}</p>
        ) : (
          <p className="text-red-400 text-sm">No site address — add it on the project page</p>
        )}
      </section>

      {/* Emergency info */}
      <section className="border border-border rounded-sm p-6 mb-6">
        <h2 className="text-text-primary font-semibold mb-4">Emergency Information</h2>
        <div className="mb-4 text-sm text-text-muted space-y-1">
          <p><span className="text-text-primary font-medium">911</span> — All life-threatening emergencies</p>
          <p><span className="text-text-primary font-medium">Poison Control:</span> 1-800-222-1222</p>
          <p><span className="text-text-primary font-medium">Nevada OSHA:</span> (775) 688-3045</p>
          {project.nearestER && (
            <p><span className="text-text-primary font-medium">Nearest ER:</span> {project.nearestER}{project.nearestERAddress ? ` — ${project.nearestERAddress}` : ""}</p>
          )}
          {project.assemblyPoint && (
            <p><span className="text-text-primary font-medium">Assembly Point:</span> {project.assemblyPoint}</p>
          )}
        </div>
        <EmergencyInfoForm
          projectId={id}
          initial={{
            nearestER: project.nearestER ?? null,
            nearestERAddress: project.nearestERAddress ?? null,
            assemblyPoint: project.assemblyPoint ?? null,
          }}
        />
      </section>

      {/* Key contacts */}
      {superintendent && (
        <section className="border border-border rounded-sm p-6 mb-6">
          <h2 className="text-text-primary font-semibold mb-3">Key Contacts</h2>
          <div className="text-sm">
            <p className="text-text-muted">Superintendent</p>
            <p className="text-text-primary font-medium">{superintendent.employee.legalName}</p>
            <p className="text-text-muted">{superintendent.employee.contact.phone ?? "No phone on file"}</p>
          </div>
        </section>
      )}

      {/* Team phone tree */}
      <section className="border border-border rounded-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-text-primary font-semibold">Team Phone Tree</h2>
          <Link
            href={`/internal/projects/${id}/phone-tree/print`}
            target="_blank"
            className="text-text-muted text-xs hover:text-text-primary"
          >
            Print Phone Tree
          </Link>
        </div>
        {project.teamMembers.length === 0 ? (
          <p className="text-text-muted text-sm">No team members assigned. Add workers on the project page.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {project.teamMembers.map((m) => {
              const compliance = getComplianceStatus(m.employee.certifications);
              return (
                <div key={m.id} className="border border-border rounded-sm px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-text-primary text-sm font-medium">{m.employee.legalName}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-text-muted text-xs capitalize">{m.role}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-sm ${complianceBadgeClass(compliance)}`}>
                        {complianceBadgeLabel(compliance)}
                      </span>
                    </div>
                  </div>
                  <p className="text-text-muted text-xs">{m.employee.contact.phone ?? "No phone"}</p>
                  <p className="text-text-muted text-xs">
                    EC: {m.employee.ec1Name} ({m.employee.ec1Relationship}) — {m.employee.ec1Phone}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Hazard notes */}
      {project.hazardNotes && (
        <section className="border border-border rounded-sm p-6">
          <h2 className="text-text-primary font-semibold mb-3">Site-Specific Hazards</h2>
          <p className="text-text-muted text-sm whitespace-pre-wrap">{project.hazardNotes}</p>
        </section>
      )}
    </div>
  );
}
