import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  getComplianceStatus,
  isOnboardingComplete,
  complianceBadgeClass,
  complianceBadgeLabel,
  formatEmployeeName,
} from "@/lib/employees";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const employees = await prisma.employee.findMany({
    where: { activeStatus: { not: "terminated" } },
    include: {
      contact: { select: { firstName: true, lastName: true, email: true } },
      certifications: true,
      onboardingSteps: { select: { stepName: true, completedAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Employees</h1>
        <Link
          href="/internal/employees/new"
          className="bg-accent text-bg font-semibold px-5 py-2.5 rounded-sm text-sm hover:bg-accent/90 transition-colors"
        >
          Add Employee
        </Link>
      </div>

      {employees.length === 0 ? (
        <div className="border border-border rounded-sm p-12 text-center">
          <p className="text-text-muted mb-4">No employees yet.</p>
          <Link href="/internal/employees/new" className="text-accent text-sm hover:underline">
            Add your first employee
          </Link>
        </div>
      ) : (
        <div className="border border-border rounded-sm divide-y divide-border">
          {employees.map((emp) => {
            const compliance = getComplianceStatus(emp.certifications);
            const onboarded = isOnboardingComplete(emp.onboardingSteps);
            const name = formatEmployeeName({
              legalName: emp.legalName,
              firstName: emp.contact.firstName,
              lastName: emp.contact.lastName,
            });

            return (
              <Link
                key={emp.id}
                href={`/internal/employees/${emp.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-surface/50 transition-colors"
              >
                <div>
                  <p className="text-text-primary font-medium">{name}</p>
                  <p className="text-text-muted text-sm mt-0.5">
                    {emp.tradeClassification} · {emp.employmentType === "W2" ? "W-2" : "1099"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {!onboarded && (
                    <span className="text-xs px-2 py-1 rounded-sm bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                      Onboarding Incomplete
                    </span>
                  )}
                  <span className={`text-xs px-2 py-1 rounded-sm ${complianceBadgeClass(compliance)}`}>
                    {complianceBadgeLabel(compliance)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
