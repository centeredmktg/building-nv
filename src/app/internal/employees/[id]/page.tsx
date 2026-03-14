import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getComplianceStatus,
  isOnboardingComplete,
  complianceBadgeClass,
  complianceBadgeLabel,
  formatEmployeeName,
} from "@/lib/employees";

export const dynamic = "force-dynamic";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      contact: true,
      certifications: { orderBy: { createdAt: "desc" } },
      onboardingSteps: { orderBy: { stepName: "asc" } },
      projectTeam: {
        include: { project: { select: { id: true, name: true, stage: true } } },
      },
    },
  });

  if (!employee) notFound();

  const compliance = getComplianceStatus(employee.certifications);
  const onboarded = isOnboardingComplete(employee.onboardingSteps);
  const name = formatEmployeeName({
    legalName: employee.legalName,
    firstName: employee.contact.firstName,
    lastName: employee.contact.lastName,
  });

  const field = (label: string, value: string | null | undefined) =>
    value ? (
      <div>
        <p className="text-text-muted text-xs uppercase tracking-wider mb-1">{label}</p>
        <p className="text-text-primary text-sm">{value}</p>
      </div>
    ) : null;

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{name}</h1>
          <p className="text-text-muted text-sm mt-1">
            {employee.tradeClassification} ·{" "}
            {employee.employmentType === "W2" ? "W-2 Employee" : "1099 Contractor"} ·{" "}
            <span className="capitalize">{employee.activeStatus}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/internal/employees/${id}/print`}
            target="_blank"
            className="text-text-muted text-sm hover:text-text-primary transition-colors"
          >
            Print Profile
          </Link>
          <span className={`text-xs px-2 py-1 rounded-sm ${complianceBadgeClass(compliance)}`}>
            {complianceBadgeLabel(compliance)}
          </span>
        </div>
      </div>

      {/* Contact info */}
      <section className="border border-border rounded-sm p-6 mb-6">
        <h2 className="text-text-primary font-semibold mb-4">Contact Information</h2>
        <div className="grid grid-cols-2 gap-4">
          {field("Email", employee.contact.email)}
          {field("Phone", employee.contact.phone)}
          {field("Home Address", `${employee.homeAddress}, ${employee.city}, ${employee.state} ${employee.zip}`)}
          {field("Hire Date", employee.hireDate.toLocaleDateString())}
          {field("Driver's License", employee.driversLicenseNumber)}
          {field("License Expiry", employee.driversLicenseExpiry?.toLocaleDateString())}
        </div>
      </section>

      {/* Emergency contacts */}
      <section className="border border-border rounded-sm p-6 mb-6">
        <h2 className="text-text-primary font-semibold mb-4">Emergency Contacts</h2>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-text-muted text-xs uppercase tracking-wider mb-2">Primary</p>
            <p className="text-text-primary text-sm font-medium">{employee.ec1Name}</p>
            <p className="text-text-muted text-sm">{employee.ec1Relationship}</p>
            <p className="text-text-muted text-sm">{employee.ec1Phone}</p>
          </div>
          {employee.ec2Name && (
            <div>
              <p className="text-text-muted text-xs uppercase tracking-wider mb-2">Secondary</p>
              <p className="text-text-primary text-sm font-medium">{employee.ec2Name}</p>
              <p className="text-text-muted text-sm">{employee.ec2Relationship}</p>
              <p className="text-text-muted text-sm">{employee.ec2Phone}</p>
            </div>
          )}
        </div>
      </section>

      {/* Certifications */}
      <section className="border border-border rounded-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-text-primary font-semibold">Certifications</h2>
          <Link
            href={`/internal/employees/${id}/certifications/new`}
            className="text-accent text-sm hover:underline"
          >
            Add Certification
          </Link>
        </div>
        {employee.certifications.length === 0 ? (
          <p className="text-text-muted text-sm">No certifications on file.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {employee.certifications.map((cert) => (
              <div
                key={cert.id}
                className="flex items-center justify-between border border-border rounded-sm px-4 py-3"
              >
                <div>
                  <p className="text-text-primary text-sm font-medium">{cert.type.replace("_", " ")}</p>
                  <p className="text-text-muted text-xs mt-0.5">
                    Issued: {cert.issueDate.toLocaleDateString()}
                    {cert.expirationDate ? ` · Expires: ${cert.expirationDate.toLocaleDateString()}` : " · No Expiry"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {cert.cardPhotoUrl ? (
                    <a
                      href={cert.cardPhotoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent text-xs hover:underline"
                    >
                      View Card
                    </a>
                  ) : (
                    <span className="text-xs text-red-400">No Card Photo</span>
                  )}
                  <span
                    className={`text-xs px-2 py-1 rounded-sm ${
                      cert.verifiedStatus === "verified"
                        ? "bg-green-500/10 text-green-400 border border-green-500/20"
                        : "bg-red-500/10 text-red-400 border border-red-500/20"
                    }`}
                  >
                    {cert.verifiedStatus}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Onboarding status */}
      <section className="border border-border rounded-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-text-primary font-semibold">Onboarding</h2>
          <span
            className={`text-xs px-2 py-1 rounded-sm ${
              onboarded
                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
            }`}
          >
            {onboarded ? "Complete" : "In Progress"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            "personal_info", "emergency_contacts", "employment_docs",
            "gusto_setup", "osha_certification", "safety_manual_ack",
            "workbook_ack", "complete",
          ].map((stepName) => {
            const step = employee.onboardingSteps.find((s) => s.stepName === stepName);
            const done = !!step?.completedAt;
            return (
              <div key={stepName} className="flex items-center gap-2">
                <span className={`text-xs ${done ? "text-green-400" : "text-text-muted"}`}>
                  {done ? "✓" : "○"}
                </span>
                <span className="text-text-muted text-xs capitalize">
                  {stepName.replace(/_/g, " ")}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Project assignments */}
      {employee.projectTeam.length > 0 && (
        <section className="border border-border rounded-sm p-6">
          <h2 className="text-text-primary font-semibold mb-4">Project Assignments</h2>
          <div className="flex flex-col gap-2">
            {employee.projectTeam.map((tm) => (
              <div key={tm.id} className="flex items-center justify-between">
                <Link
                  href={`/internal/projects/${tm.projectId}`}
                  className="text-accent text-sm hover:underline"
                >
                  {tm.project.name}
                </Link>
                <span className="text-text-muted text-xs capitalize">{tm.role}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
