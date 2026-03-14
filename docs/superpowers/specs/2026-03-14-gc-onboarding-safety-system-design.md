# GC Onboarding & Safety System — Design Spec
**Date:** 2026-03-14
**Project:** building-nv (bldn-inc)
**Status:** Approved

---

## Overview

A hybrid onboarding and safety compliance system for a Nevada-based general contracting business. Combines static, version-controlled compliance documents with dynamic app-generated outputs driven by live project and employee data.

The system has two parallel tracks:

- **Content Track** — Company Safety Manual and Employee Onboarding Workbook as markdown source files in the repository
- **App Track** — Employee module, project safety plan, digital onboarding flow, and print templates built into the building-nv Next.js application

---

## Goals

- Achieve and maintain OSHA 29 CFR 1926 (construction) and Nevada State Plan (NRS Chapter 618 / NAC 618) compliance
- Give every job site a physical binder with current, project-specific safety documentation — easy to print, easy to regenerate
- Digitize new hire onboarding with hard gates that enforce data completeness and document acknowledgment
- Build a reusable person/employee data model that supports phone trees, incident response, and emergency contact access
- Integrate without duplicating Gusto (payroll) or QuickBooks (accounting) — the app confirms setup, doesn't replace it

---

## Non-Goals

- Payroll processing — handled by Gusto
- Accounting — handled by QuickBooks (Desktop or Online, TBD)
- Full HRIS — the employee module is purpose-built for compliance and field operations, not a people management platform
- SDS (Safety Data Sheets) management — SDS binder is a separate physical document; this system references its existence but does not manage individual SDS records
- Automated email/SMS alerts for expiring certifications — flagged in UI only in this phase

---

## Track 1: Content Documents

Both documents are maintained as markdown files in the repository, version-controlled via git. They are the authoritative source of truth for company policy. Changes go through a review commit — no silent edits.

### 1a. Company Safety Manual

**Location:** `docs/safety/safety-manual.md`

**Compliance coverage:**
- OSHA 29 CFR 1926 (Construction Industry Standards)
- Nevada Occupational Safety and Health Act (NRS Chapter 618)
- Nevada Administrative Code Chapter 618 (Nevada OSHA regulations)
- OSHA Hazard Communication Standard (HazCom / GHS, 29 CFR 1910.1200)

**Sections:**
1. Company Safety Policy Statement (signed by owner)
2. Scope and Applicability
3. Roles and Responsibilities
   - Owner / Principal
   - Project Superintendent
   - Foreman
   - All Workers
   - Subcontractors
4. Hazard Communication (HazCom)
   - SDS binder requirement and access
   - Chemical labeling (GHS format)
   - Employee right-to-know
5. Personal Protective Equipment (PPE)
   - Requirements by task/trade type
   - Inspection and replacement
   - Issue log requirement
6. Fall Protection (OSHA 1926 Subpart M)
   - 6-foot threshold triggers fall protection
   - Guardrails, personal fall arrest systems, safety nets
   - Hole covers and floor opening requirements
7. Scaffolding (OSHA 1926 Subpart L)
8. Ladders (OSHA 1926 Subpart X)
9. Excavation and Trenching (OSHA 1926 Subpart P)
10. Electrical Safety (OSHA 1926 Subpart K)
    - GFCI requirements
    - Lockout/Tagout
11. Tool and Equipment Safety
    - Power tools, hand tools, pneumatic tools
    - Inspection requirements
12. Heat Illness Prevention (Nevada-specific)
    - NAC 618 requirements
    - Water, shade, acclimatization
    - Signs, symptoms, and response
13. Silica and Dust Control (OSHA 1926.1153)
14. Housekeeping and Site Organization
15. Incident Reporting and Investigation
    - What must be reported (immediate, 8-hour, 24-hour thresholds per OSHA)
    - Nevada OSHA reporting requirements (NRS 618.375)
    - Internal investigation procedure
    - Recordkeeping (OSHA 300 log)
16. Drug and Alcohol Policy
17. Emergency Action Plan
    - Evacuation procedures
    - Assembly point designation (site-specific — references project safety plan)
    - Emergency contact structure (references project phone tree)
18. Employee Rights and Anti-Retaliation (NRS 618.445)
19. Disciplinary Policy for Safety Violations
20. Safety Training Requirements
    - OSHA 10 (required for all W-2 field workers; must complete within 30 days of hire if not already certified)
    - OSHA 30 (required for superintendents and foremen)
    - Company orientation (this manual)
    - Note: OSHA 10 enforcement applies to W-2 employees per Nevada OSHA state plan; 1099 subcontractors are subject to separate subcontractor safety requirements (Section 21)
21. Subcontractor Safety Requirements
    - Subcontractors are responsible for their own OSHA compliance
    - GC reserves right to remove non-compliant subcontractors from site
    - Required: proof of workers' comp, liability insurance, and OSHA 10 on superintendent
22. Document Control and Manual Updates

### 1b. Employee Onboarding Workbook

**Location:** `docs/hr/onboarding-workbook.md`

**Sections:**
1. Welcome Letter (from owner)
2. Company Overview — mission, values, how we operate
3. Employment Classification
   - W-2 employees vs. 1099 subcontractors
   - Full-time, part-time, seasonal
4. Compensation and Pay Schedule
   - Pay periods, Gusto direct deposit setup instructions
   - Overtime policy (Nevada: daily OT over 8 hours per NRS 608.018)
5. Work Hours and Scheduling
6. Code of Conduct
   - Professional behavior on job sites
   - Social media policy
   - Confidentiality
7. Safety Acknowledgment
   - Confirmation that employee received and reviewed the Safety Manual
   - Signature required (digital in app, wet ink on printed form)
8. New Hire Checklist
   - [ ] I-9 completed and ID documents verified
   - [ ] W-4 completed
   - [ ] Gusto account set up and direct deposit confirmed
   - [ ] Emergency contact form completed
   - [ ] OSHA certification verified (card photo uploaded) — W-2 field workers only; 30-day grace for new certifications
   - [ ] PPE issued and logged
   - [ ] Company orientation completed
   - [ ] Safety Manual acknowledged (signed)
9. Training Requirements and Timeline
   - OSHA 10 (if not already certified): W-2 field workers must complete within 30 days of hire
   - OSHA 30: required for superintendent and foreman roles prior to site assignment
   - Company safety orientation: day one
10. Benefits Overview (placeholder — to be completed as benefits are established)
11. Acknowledgment and Signature Page
    - Employee signature, date
    - Supervisor signature, date
    - Copy retained in employee file

---

## Track 2: App Features

All features are built into the existing building-nv Next.js application with Prisma/SQLite.

### Data Model Design Principles

**Person = Contact.** The existing `Contact` model (with `type` field: customer | vendor | pm | other) is the person node. `type = "employee"` is added as a valid value. Employee-specific data lives in a separate `Employee` model with a 1:1 relation to `Contact` — this avoids polluting Contact with nullable fields irrelevant to customers and vendors, and avoids SQLite migration issues from adding non-nullable columns to an existing populated table.

### 2a. New Prisma Models

```prisma
// Employee profile — 1:1 with Contact, only exists when contact.type = "employee"
model Employee {
  id                 String    @id @default(cuid())
  contactId          String    @unique
  contact            Contact   @relation(fields: [contactId], references: [id], onDelete: Cascade)

  // Identity
  legalName          String
  hireDate           DateTime
  employmentType     String    // "W2" | "CONTRACTOR_1099"
  tradeClassification String   // "laborer" | "carpenter" | "electrician" | "superintendent" | "pm" | "other"
  activeStatus       String    @default("active") // "active" | "inactive" | "terminated"
  terminatedAt       DateTime?

  // Address
  homeAddress        String
  city               String
  state              String
  zip                String

  // Emergency contacts
  ec1Name            String
  ec1Relationship    String
  ec1Phone           String
  ec2Name            String?
  ec2Relationship    String?
  ec2Phone           String?

  // Optional compliance fields
  driversLicenseNumber  String?
  driversLicenseExpiry  DateTime?

  // Relations
  certifications     Certification[]
  onboardingSteps    OnboardingStep[]
  projectTeam        ProjectTeamMember[]

  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
}

// OSHA and other certifications — one per card, photo required for OSHA_10/OSHA_30
model Certification {
  id             String    @id @default(cuid())
  employeeId     String
  employee       Employee  @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  type           String    // "OSHA_10" | "OSHA_30" | "FIRST_AID" | "OTHER"
  issueDate      DateTime
  expirationDate DateTime? // OSHA cards don't expire; First Aid/CPR typically 2yr
  cardPhotoUrl   String?   // required for OSHA_10 and OSHA_30; upload via file storage
  verifiedStatus String    @default("unverified") // "unverified" | "verified"
  // verifiedStatus = "verified" only when cardPhotoUrl is present
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
}

// Per-step tracking for the digital onboarding flow
model OnboardingStep {
  id          String    @id @default(cuid())
  employeeId  String
  employee    Employee  @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  stepName    String    // "personal_info" | "emergency_contacts" | "employment_docs" |
                        // "gusto_setup" | "osha_certification" | "safety_manual_ack" |
                        // "workbook_ack" | "complete"
  completedAt DateTime?
  // e-signature stored as text (signer name + timestamp) — reuses Acceptance pattern
  signerName  String?
  ipAddress   String?

  @@unique([employeeId, stepName])
}

// Pre-hire invite — allows sending onboarding link before Contact record is fully created
model OnboardingInvite {
  id          String    @id @default(cuid())
  token       String    @unique @default(cuid())
  email       String
  expiresAt   DateTime
  status      String    @default("pending") // "pending" | "completed" | "expired"
  contactId   String?   // set once the employee completes step 1 and Contact record is created
  createdAt   DateTime  @default(now())
}

// Project team assignment — employees and 1099 workers assigned to a job site
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

**Existing model changes (minimal, additive):**

```prisma
// Contact — add "employee" to the type comment; no schema change needed
// type String @default("customer") // customer | vendor | pm | employee | other

// Project — add site address fields and hazard notes
// Note: existing Project.notes is for internal CRM notes (deal context, client comms).
// hazardNotes is a separate field for job-site-specific safety hazards shown on the safety plan.
model Project {
  // ... existing fields ...
  siteAddress  String?
  siteCity     String?
  siteState    String?
  siteZip      String?
  hazardNotes  String?   // safety-plan-specific; distinct from notes (CRM use)
  teamMembers  ProjectTeamMember[]
}
```

All new `Employee` fields are non-nullable only on the `Employee` model itself, so existing `Contact` records are unaffected. SQLite migration adds new tables and nullable columns to `Project` only.

### 2b. Employee Profile UI

**Routes:** `/internal/employees` (list) and `/internal/employees/[id]` (detail)

**List view:** table of employees with name, trade, status, onboarding progress, and certification compliance badge. Incomplete records (missing required Employee fields) show a yellow flag. Unverified OSHA certs show an orange flag. Expired certs (where `expirationDate < today`) show a red flag. Certs expiring within 30 days show a yellow flag.

**Detail view:** all Employee fields, certifications with upload UI, onboarding checklist status, project assignments.

**Termination behavior:** when `activeStatus = "terminated"`, the employee is hidden from the active employee list and removed from all active project team views. Their record is retained for compliance purposes (OSHA 300 log, incident history). Termination sets `terminatedAt` timestamp.

### 2c. Certification Upload Flow

Available from the employee detail page and from the onboarding flow.

- Select cert type → enter issue date and optional expiration date → upload card photo (image file)
- File stored via Vercel Blob (recommended: built-in with Next.js deployment, no separate S3 setup)
- On successful upload: `cardPhotoUrl` set, `verifiedStatus` → `"verified"` for OSHA_10 and OSHA_30
- **Hard rule:** OSHA_10 and OSHA_30 without `cardPhotoUrl` remain `unverified` regardless of dates entered

**Expiration handling:**
- `expirationDate < today`: cert shows as **Expired** (red) in employee record and is excluded from project safety plan
- `expirationDate` within 30 days: cert shows as **Expiring Soon** (yellow)
- No `expirationDate` (OSHA cards): shows as **No Expiry** — valid indefinitely unless photo is missing

### 2d. Project Safety Plan

**Route:** `/internal/projects/[id]/safety-plan` with a `/print` variant

**Data assembled from:**
- `Project.name`, `siteAddress`, `siteCity`, `siteState`, `siteZip` → geocoded to nearest ER (Mapbox Geocoding API or manual override)
- Local emergency numbers populated by city/ZIP lookup or manual entry per project
- `ProjectTeamMember` → `Employee` → `ec1Name`, `ec1Phone` (and EC2 if present)
- Project-specific hazard notes (free text on Project record)
- Superintendent pulled from team member with `role = "superintendent"`

**Fallback for address:** if `Project.siteAddress` is null, falls back to linked `Quote.address` if a quote exists. If neither is set, the safety plan shows an "Address required" warning and blocks print.

**Printed output (one page target, two max):**
- Project name, site address
- Date generated (for binder currency)
- Emergency services: 911, nearest ER (name + address + approximate distance), nearest urgent care
- Superintendent: name + cell
- Owner/principal: name + cell
- On-site team phone tree: name, role, cell, EC1 name + phone
- Project-specific hazards and notes
- Assembly point (free text)

**Print approach:** `/print` route with `@media print` CSS — no PDF library required. Navigation chrome hidden, clean binder-ready layout at standard letter size.

### 2e. Digital Onboarding Flow

**Route:** `/onboarding/[token]` — public route, no login required, accessed via unique invite link

**Invite flow:** admin creates an `OnboardingInvite` (enters new hire's email) → system sends link via Resend (existing integration) → new hire opens link → completes steps → `OnboardingInvite.status` → `"completed"`, `contactId` set

**Steps:**

| Step | Key | What it captures |
|------|-----|-----------------|
| 1 | `personal_info` | Legal name, address, trade, employment type — creates Contact + Employee records |
| 2 | `emergency_contacts` | EC1 (required), EC2 (optional) |
| 3 | `employment_docs` | Checkbox: "I understand I-9 and W-4 must be completed with my supervisor" |
| 4 | `gusto_setup` | Checkbox: "I have set up my Gusto account and direct deposit" |
| 5 | `osha_certification` | Select type → upload card photo (OSHA 10/30) OR acknowledge 30-day completion deadline (if uncertified). W-2 only; 1099 workers skip. |
| 6 | `safety_manual_ack` | Link to safety manual → e-signature (name + timestamp, stored as OnboardingStep.signerName) |
| 7 | `workbook_ack` | Onboarding workbook acknowledgment → e-signature |
| 8 | `complete` | Confirmation screen; completion timestamp recorded |

**Hard gates:**
- Cannot advance past Step 2 without EC1 complete
- Cannot complete Step 6 without e-signature
- Cannot reach Step 8 without Steps 6 and 7 signed
- OSHA cert without photo = `unverified` (allowed to complete onboarding but flagged in employee record)

**W-2 vs. 1099 divergence:** Step 5 (OSHA) is shown only to W-2 workers (`employmentType = "W2"`). 1099 contractors skip to Step 6. This reflects that Nevada OSHA's OSHA 10 requirement applies to the GC's W-2 employees; subcontractors are responsible for their own compliance.

### 2f. Print Templates

All implemented as print routes with `@media print` CSS — no PDF generation library required in this phase.

**Job Site Binder** (`/internal/projects/[id]/binder/print`):
- Cover page: project name, address, superintendent, date generated
- Project safety plan (Section 2d output)
- Key safety manual excerpts: emergency action plan, PPE requirements, incident reporting procedure, heat illness prevention, fall protection summary
- Blank incident report form
- SDS binder location notice ("See red binder at site office")

**Employee Phone Tree** (`/internal/projects/[id]/phone-tree/print`):
- Standalone: project name, date, list of assigned team members with role, cell, EC1 name + phone
- Available independently from the job site binder

**Employee Profile Sheet** (`/internal/employees/[id]/print`):
- Single page: legal name, address, trade, hire date, employment type, active status, cert status, EC1 and EC2
- For physical HR file

---

## Integration Points

| System | Integration |
|--------|-------------|
| Gusto | Onboarding checklist confirms Gusto account setup — no API integration in this phase |
| QuickBooks | Not touched in this phase |
| Vercel Blob | File storage for OSHA card photo uploads — built-in to Next.js/Vercel, recommended over separate S3 setup |
| Mapbox | Geocoding for nearest ER lookup on project safety plan (Mapbox Geocoding API) |
| Resend | Onboarding invite link delivery — uses existing Resend integration |
| Onboarding link delivery | Email only in this phase; SMS is a future option |

---

## Compliance Reference

| Regulation | Scope |
|-----------|-------|
| OSHA 29 CFR 1926 | Federal construction safety standards |
| OSHA 29 CFR 1910.1200 | Hazard Communication (HazCom/GHS) |
| NRS Chapter 618 | Nevada Occupational Safety and Health Act |
| NAC Chapter 618 | Nevada OSHA administrative regulations |
| NRS 608.018 | Nevada daily overtime law (OT after 8 hours/day) |
| NRS 618.375 | Nevada OSHA incident reporting requirements |
| NRS 618.445 | Employee rights and anti-retaliation |

---

## Open Questions (non-blocking)

- Mapbox vs. Google Maps for geocoding — Mapbox recommended (generous free tier, better Next.js integration)
- QuickBooks Online migration timing — no integration work in this phase either way
- Future: automated cert expiration notifications (email/SMS) — out of scope for this phase, flagged for future

---

## Delivery Sequence

1. Draft Safety Manual content (`docs/safety/safety-manual.md`)
2. Draft Onboarding Workbook content (`docs/hr/onboarding-workbook.md`)
3. Prisma schema migrations: `Employee`, `Certification`, `OnboardingStep`, `OnboardingInvite`, `ProjectTeamMember`; add address + team relation to `Project`
4. Build employee list + detail pages with field validation and compliance status badges
5. Confirm Vercel Blob setup → build certification upload flow (photo → verified status)
6. Build project safety plan page + print view (requires Step 3 address fields + team assignment)
7. Build digital onboarding flow: invite creation, public `/onboarding/[token]` route, all 8 steps
8. Build print templates: job site binder, phone tree, employee profile sheet
9. Wire onboarding invite delivery via Resend
