import type {
  CertificationShape,
  ComplianceStatus,
  OnboardingStepShape,
} from "./employeeTypes";
import { ONBOARDING_STEPS } from "./employeeTypes";

/**
 * Returns the OSHA compliance status for an employee based on their certifications.
 * Checks OSHA_10 and OSHA_30 certs only (these require card photo for verification).
 */
export function getComplianceStatus(
  certifications: CertificationShape[]
): ComplianceStatus {
  const oshaCerts = certifications.filter(
    (c) => c.type === "OSHA_10" || c.type === "OSHA_30"
  );

  if (oshaCerts.length === 0) return "no_cert";

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Note: worst-case-wins across multiple certs. If an employee has two OSHA
  // certs and the first is expired, we return "expired" without checking the
  // second. This is intentional — a bad cert poisons the record until resolved.
  for (const cert of oshaCerts) {
    if (cert.expirationDate && cert.expirationDate < now) return "expired";
    if (cert.expirationDate && cert.expirationDate < thirtyDaysFromNow)
      return "expiring_soon";
    if (!cert.cardPhotoUrl) return "unverified";
    if (cert.verifiedStatus === "verified") return "verified";
  }

  return "unverified";
}

/**
 * Returns true only if all 8 onboarding steps have a completedAt timestamp.
 */
export function isOnboardingComplete(steps: OnboardingStepShape[]): boolean {
  return ONBOARDING_STEPS.every((stepName) => {
    const step = steps.find((s) => s.stepName === stepName);
    return step?.completedAt != null;
  });
}

/**
 * Returns display name — prefers legalName, falls back to firstName + lastName.
 */
export function formatEmployeeName(person: {
  legalName: string | null;
  firstName: string;
  lastName: string | null;
}): string {
  if (person.legalName) return person.legalName;
  return [person.firstName, person.lastName].filter(Boolean).join(" ");
}

/**
 * Returns a CSS class string for a compliance status badge.
 */
export function complianceBadgeClass(status: ComplianceStatus): string {
  switch (status) {
    case "verified":
      return "bg-green-500/10 text-green-400 border border-green-500/20";
    case "expiring_soon":
      return "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20";
    case "expired":
    case "unverified":
    case "no_cert":
      return "bg-red-500/10 text-red-400 border border-red-500/20";
  }
}

/**
 * Returns human-readable label for compliance status.
 */
export function complianceBadgeLabel(status: ComplianceStatus): string {
  switch (status) {
    case "verified":       return "OSHA Verified";
    case "unverified":     return "No Card Photo";
    case "no_cert":        return "No Certification";
    case "expired":        return "Cert Expired";
    case "expiring_soon":  return "Expiring Soon";
  }
}
