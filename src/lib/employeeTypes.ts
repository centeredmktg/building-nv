// Types for the Employee module.
// These mirror the Prisma models but are safe to import in client components.

export type EmploymentType = "W2" | "CONTRACTOR_1099";
export type ActiveStatus = "active" | "inactive" | "terminated";
export type TradeClassification =
  | "laborer"
  | "carpenter"
  | "electrician"
  | "superintendent"
  | "pm"
  | "other";
export type CertificationType = "OSHA_10" | "OSHA_30" | "FIRST_AID" | "OTHER";
export type VerifiedStatus = "unverified" | "verified";
export type ComplianceStatus =
  | "verified"
  | "unverified"
  | "no_cert"
  | "expired"
  | "expiring_soon";
export type OnboardingStepName =
  | "personal_info"
  | "emergency_contacts"
  | "employment_docs"
  | "gusto_setup"
  | "osha_certification"
  | "safety_manual_ack"
  | "workbook_ack"
  | "complete";

export const ONBOARDING_STEPS: OnboardingStepName[] = [
  "personal_info",
  "emergency_contacts",
  "employment_docs",
  "gusto_setup",
  "osha_certification",
  "safety_manual_ack",
  "workbook_ack",
  "complete",
];

export interface CertificationShape {
  id: string;
  type: string;
  issueDate: Date;
  expirationDate: Date | null;
  cardPhotoUrl: string | null;
  verifiedStatus: string;
}

export interface OnboardingStepShape {
  stepName: string;
  completedAt: Date | null;
}
