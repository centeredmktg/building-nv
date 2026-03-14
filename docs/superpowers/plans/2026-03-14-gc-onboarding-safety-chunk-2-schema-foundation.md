# GC Onboarding & Safety — Chunk 2: Schema + Foundation

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Prisma schema to add all new models (Employee, Certification, OnboardingStep, OnboardingInvite, ProjectTeamMember), extend Project with site address + hazardNotes, extend Component with SDS fields, add employee lib + types, and add Employees/HR nav link.

**Architecture:** Prisma schema-first. All new models are additive — no existing models are modified in breaking ways. Employee is a 1:1 extension of Contact (separate model, not nullable columns on Contact). All new fields on existing models (Project, Component) are nullable to avoid SQLite migration issues on populated tables.

**Tech Stack:** Prisma 7 + SQLite (better-sqlite3), TypeScript, Next.js 16

**Spec reference:** `docs/superpowers/specs/2026-03-14-gc-onboarding-safety-system-design.md` — Section 2a (data model)

**Prerequisite:** Chunk 1 committed.

---

## Chunk 2, Task 3: Prisma Schema Migrations

**Files:**
- Modify: `prisma/schema.prisma`
- Auto-generated: `prisma/migrations/` (via `npx prisma migrate dev`)

- [ ] **Step 1: Write the failing test for employee validation logic**

Create `src/__tests__/employees.test.ts`:

```typescript
import {
  getComplianceStatus,
  isOnboardingComplete,
  formatEmployeeName,
} from "@/lib/employees";

describe("getComplianceStatus", () => {
  const baseCert = {
    id: "c1",
    type: "OSHA_10",
    issueDate: new Date("2023-01-01"),
    expirationDate: null,
    cardPhotoUrl: "https://example.com/card.jpg",
    verifiedStatus: "verified",
  };

  it("returns verified when OSHA_10 cert has photo", () => {
    expect(getComplianceStatus([baseCert])).toBe("verified");
  });

  it("returns unverified when OSHA_10 cert has no photo", () => {
    const cert = { ...baseCert, cardPhotoUrl: null, verifiedStatus: "unverified" };
    expect(getComplianceStatus([cert])).toBe("unverified");
  });

  it("returns no_cert when no OSHA certifications", () => {
    expect(getComplianceStatus([])).toBe("no_cert");
  });

  it("returns expired when cert expirationDate is in the past", () => {
    const cert = { ...baseCert, expirationDate: new Date("2020-01-01") };
    expect(getComplianceStatus([cert])).toBe("expired");
  });

  it("returns expiring_soon when cert expires within 30 days", () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 15);
    const cert = { ...baseCert, expirationDate: soon };
    expect(getComplianceStatus([cert])).toBe("expiring_soon");
  });
});

describe("isOnboardingComplete", () => {
  const allSteps = [
    "personal_info", "emergency_contacts", "employment_docs",
    "gusto_setup", "osha_certification", "safety_manual_ack",
    "workbook_ack", "complete",
  ].map((stepName) => ({ stepName, completedAt: new Date() }));

  it("returns true when all steps completed", () => {
    expect(isOnboardingComplete(allSteps)).toBe(true);
  });

  it("returns false when any step is missing", () => {
    const partial = allSteps.filter((s) => s.stepName !== "safety_manual_ack");
    expect(isOnboardingComplete(partial)).toBe(false);
  });

  it("returns false when a step has no completedAt", () => {
    const incomplete = allSteps.map((s) =>
      s.stepName === "workbook_ack" ? { ...s, completedAt: null } : s
    );
    expect(isOnboardingComplete(incomplete)).toBe(false);
  });
});

describe("formatEmployeeName", () => {
  it("returns legalName when present", () => {
    expect(formatEmployeeName({ legalName: "John Smith", firstName: "John", lastName: "Smith" }))
      .toBe("John Smith");
  });

  it("falls back to firstName + lastName when no legalName", () => {
    expect(formatEmployeeName({ legalName: null, firstName: "John", lastName: "Smith" }))
      .toBe("John Smith");
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest src/__tests__/employees.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/employees'`

- [ ] **Step 3: Update prisma/schema.prisma**

Add the following to `prisma/schema.prisma` after the existing CRM section. Do not modify existing models — only add new models and nullable fields:

```prisma
// ─── HR: Employee Module ───────────────────────────────────────────────────────

// 1:1 extension of Contact. Only exists when contact.type = "employee".
// All required fields live here — Contact is not polluted with nullable columns.
model Employee {
  id                  String    @id @default(cuid())
  contactId           String    @unique
  contact             Contact   @relation(fields: [contactId], references: [id], onDelete: Cascade)

  // Identity
  legalName           String
  hireDate            DateTime
  employmentType      String    // "W2" | "CONTRACTOR_1099"
  tradeClassification String    // "laborer" | "carpenter" | "electrician" | "superintendent" | "pm" | "other"
  activeStatus        String    @default("active") // "active" | "inactive" | "terminated"
  terminatedAt        DateTime?

  // Address
  homeAddress         String
  city                String
  state               String
  zip                 String

  // Emergency contact 1 (required)
  ec1Name             String
  ec1Relationship     String
  ec1Phone            String

  // Emergency contact 2 (optional)
  ec2Name             String?
  ec2Relationship     String?
  ec2Phone            String?

  // Optional compliance fields
  driversLicenseNumber String?
  driversLicenseExpiry DateTime?

  // Relations
  certifications      Certification[]
  onboardingSteps     OnboardingStep[]
  projectTeam         ProjectTeamMember[]

  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
}

// OSHA and other certifications. cardPhotoUrl required for OSHA_10 and OSHA_30.
model Certification {
  id             String    @id @default(cuid())
  employeeId     String
  employee       Employee  @relation(fields: [employeeId], references: [id], onDelete: Cascade)

  type           String    // "OSHA_10" | "OSHA_30" | "FIRST_AID" | "OTHER"
  issueDate      DateTime
  expirationDate DateTime?
  cardPhotoUrl   String?
  verifiedStatus String    @default("unverified") // "unverified" | "verified"

  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
}

// Per-step tracking for digital onboarding flow.
model OnboardingStep {
  id          String    @id @default(cuid())
  employeeId  String
  employee    Employee  @relation(fields: [employeeId], references: [id], onDelete: Cascade)

  stepName    String    // "personal_info" | "emergency_contacts" | "employment_docs" |
                        // "gusto_setup" | "osha_certification" | "safety_manual_ack" |
                        // "workbook_ack" | "complete"
  completedAt DateTime?
  signerName  String?   // for acknowledgment steps
  ipAddress   String?

  @@unique([employeeId, stepName])
}

// Pre-hire invite token — allows sending onboarding link before Contact exists.
model OnboardingInvite {
  id        String    @id @default(cuid())
  token     String    @unique @default(cuid())
  email     String
  expiresAt DateTime
  status    String    @default("pending") // "pending" | "completed" | "expired"
  contactId String?   // set after Step 1 creates the Contact record

  createdAt DateTime  @default(now())
}

// Assigns employees/contractors to a project job site.
model ProjectTeamMember {
  id         String   @id @default(cuid())
  projectId  String
  project    Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  employeeId String
  employee   Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  role       String   @default("worker") // "worker" | "foreman" | "superintendent"
  assignedAt DateTime @default(now())

  @@unique([projectId, employeeId])
}
```

Also add these nullable fields to the existing `Project` model and add the `Employee` back-relation to `Contact`:

In the `Project` model, add after `attachmentUrl`:
```prisma
  siteAddress  String?
  siteCity     String?
  siteState    String?
  siteZip      String?
  hazardNotes  String?
  teamMembers  ProjectTeamMember[]
```

In the `Contact` model, add after `projectContacts`:
```prisma
  employee     Employee?
```

In the `Component` model, add after `updatedAt`:
```prisma
  sdsUrl       String?
  isHazardous  Boolean @default(false)
```

- [ ] **Step 4: Run Prisma migration**

Note: This project uses Prisma 7 with `prisma.config.ts` for datasource configuration — the `DATABASE_URL` env var is read from `.env` via dotenv. Confirm `.env` has `DATABASE_URL="file:./prisma/dev.db"` before running.

```bash
npx prisma migrate dev --name add_employee_onboarding_sds
```

Expected output: migration created and applied, Prisma client regenerated.
If it fails with a datasource error: verify `DATABASE_URL` is set in `.env` and `prisma.config.ts` is present at project root.

- [ ] **Step 5: Verify Prisma client generated correctly**

```bash
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 6: Commit schema**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add Employee, Certification, OnboardingStep, OnboardingInvite, ProjectTeamMember models; extend Project and Component"
```

---

## Chunk 2, Task 4: Employee Lib + Types

**Files:**
- Create: `src/lib/employeeTypes.ts`
- Create: `src/lib/employees.ts`

- [ ] **Step 1: Create src/lib/employeeTypes.ts**

```typescript
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
```

- [ ] **Step 2: Create src/lib/employees.ts**

```typescript
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
```

- [ ] **Step 3: Run tests**

```bash
npx jest src/__tests__/employees.test.ts --no-coverage
```

Expected: all 9 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/employeeTypes.ts src/lib/employees.ts src/__tests__/employees.test.ts
git commit -m "feat: add employee types and compliance/onboarding utility functions"
```

---

## Chunk 2, Task 5: Update InternalNav

**Files:**
- Modify: `src/components/internal/InternalNav.tsx`

- [ ] **Step 1: Add Employees and Vendors nav links**

In `src/components/internal/InternalNav.tsx`, add `Employees` and `Vendors` to the nav link list. The current nav has: Pipeline, Quotes, Catalog.

Updated nav links block:

```tsx
{navLink("/internal/projects", "Pipeline")}
{navLink("/internal/quotes", "Quotes")}
{navLink("/internal/employees", "Employees")}
{navLink("/internal/vendors", "Vendors")}
{navLink("/internal/components", "Catalog")}
```

- [ ] **Step 2: Verify the app compiles**

```bash
npx next build 2>&1 | tail -20
```

Expected: build succeeds (exit code 0). If it fails, check for TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/internal/InternalNav.tsx
git commit -m "feat: add Employees and Vendors links to internal nav"
```

---

## Chunk 2 Complete

Schema is migrated, core utilities are tested, and nav is updated. All subsequent chunks build on this foundation. Proceed to Chunk 3 (Employee Module).
