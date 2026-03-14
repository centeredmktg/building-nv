# GC Onboarding & Safety — Chunk 3: Employee Module

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Employee list page, detail/edit page, new employee page, and all backing API routes.

**Architecture:** Follows existing patterns — server components fetch Prisma directly, client components use `fetch`. API routes use `NextRequest`/`NextResponse` + `@/lib/prisma`. Tailwind tokens: `text-text-primary`, `text-text-muted`, `text-accent`, `bg-accent`, `bg-bg`, `bg-surface`, `border-border`.

**Tech Stack:** Next.js 16, Prisma 7, TypeScript, Tailwind CSS 4

**Spec reference:** `docs/superpowers/specs/2026-03-14-gc-onboarding-safety-system-design.md` — Sections 2a, 2b

**Prerequisites:** Chunk 2 committed (schema migrated, employee lib exists, nav updated).

---

## Pre-flight Check

Before writing any code in this chunk, confirm Chunk 2 migration ran successfully:

```bash
npx prisma generate
npx prisma db push --preview-feature 2>/dev/null; npx prisma validate
```

Then confirm the generated client includes the new models:
```bash
grep -l "Employee\|Certification\|OnboardingStep\|ProjectTeamMember" src/generated/prisma/models/*.ts
```

Expected: files for Employee, Certification, OnboardingStep, ProjectTeamMember are present. If not, run `npx prisma migrate dev` from Chunk 2 before proceeding.

Also note: `formatEmployeeName` in `@/lib/employees` (created in Chunk 2) must accept `lastName: string | null` — verify this matches the Chunk 2 implementation before calling it in pages.

---

## Chunk 3, Task 6: Employee API Routes

**Files:**
- Create: `src/app/api/employees/route.ts`
- Create: `src/app/api/employees/[id]/route.ts`

- [ ] **Step 1: Create src/app/api/employees/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const employees = await prisma.employee.findMany({
    include: {
      contact: { select: { firstName: true, lastName: true, email: true, phone: true } },
      certifications: true,
      onboardingSteps: { select: { stepName: true, completedAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(employees);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    // Contact fields
    firstName, lastName, email, phone,
    // Employee fields
    legalName, hireDate, employmentType, tradeClassification,
    homeAddress, city, state, zip,
    ec1Name, ec1Relationship, ec1Phone,
    ec2Name, ec2Relationship, ec2Phone,
    driversLicenseNumber, driversLicenseExpiry,
  } = body;

  if (!firstName?.trim() || !email?.trim() || !legalName?.trim() ||
      !hireDate || !employmentType || !tradeClassification ||
      !homeAddress?.trim() || !city?.trim() || !state?.trim() || !zip?.trim() ||
      !ec1Name?.trim() || !ec1Relationship?.trim() || !ec1Phone?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const emailLower = email.trim().toLowerCase();

  // Upsert contact — employee may already exist in CRM
  const contact = await prisma.contact.upsert({
    where: { email: emailLower },
    update: { firstName: firstName.trim(), lastName: lastName?.trim() || null, phone: phone?.trim() || null, type: "employee" },
    create: { firstName: firstName.trim(), lastName: lastName?.trim() || null, email: emailLower, phone: phone?.trim() || null, type: "employee" },
  });

  // Check if Employee record already exists for this contact
  const existing = await prisma.employee.findUnique({ where: { contactId: contact.id } });
  if (existing) {
    return NextResponse.json({ error: "Employee record already exists for this contact" }, { status: 409 });
  }

  const employee = await prisma.employee.create({
    data: {
      contactId: contact.id,
      legalName: legalName.trim(),
      hireDate: new Date(hireDate),
      employmentType,
      tradeClassification,
      homeAddress: homeAddress.trim(),
      city: city.trim(),
      state: state.trim(),
      zip: zip.trim(),
      ec1Name: ec1Name.trim(),
      ec1Relationship: ec1Relationship.trim(),
      ec1Phone: ec1Phone.trim(),
      ec2Name: ec2Name?.trim() || null,
      ec2Relationship: ec2Relationship?.trim() || null,
      ec2Phone: ec2Phone?.trim() || null,
      driversLicenseNumber: driversLicenseNumber?.trim() || null,
      driversLicenseExpiry: driversLicenseExpiry ? new Date(driversLicenseExpiry) : null,
    },
    include: {
      contact: { select: { firstName: true, lastName: true, email: true, phone: true } },
    },
  });

  return NextResponse.json(employee, { status: 201 });
}
```

- [ ] **Step 2: Create src/app/api/employees/[id]/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(employee);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const allowedFields = [
    "legalName", "hireDate", "employmentType", "tradeClassification",
    "activeStatus", "terminatedAt",
    "homeAddress", "city", "state", "zip",
    "ec1Name", "ec1Relationship", "ec1Phone",
    "ec2Name", "ec2Relationship", "ec2Phone",
    "driversLicenseNumber", "driversLicenseExpiry",
  ];

  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      if (field === "hireDate" || field === "terminatedAt" || field === "driversLicenseExpiry") {
        data[field] = body[field] ? new Date(body[field]) : null;
      } else {
        data[field] = body[field];
      }
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const employee = await prisma.employee.update({ where: { id }, data });
  return NextResponse.json(employee);
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors. If errors, fix before proceeding.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/employees/
git commit -m "feat: add employees API routes (GET/POST list, GET/PATCH detail)"
```

---

## Chunk 3, Task 7: Employee List Page

**Files:**
- Create: `src/app/internal/employees/page.tsx`

- [ ] **Step 1: Create src/app/internal/employees/page.tsx**

```tsx
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/internal/employees/page.tsx
git commit -m "feat: add employee list page with compliance status badges"
```

---

## Chunk 3, Task 8: Employee Detail Page

**Files:**
- Create: `src/app/internal/employees/[id]/page.tsx`

- [ ] **Step 1: Create src/app/internal/employees/[id]/page.tsx**

```tsx
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/internal/employees/[id]/page.tsx
git commit -m "feat: add employee detail page with certifications, onboarding status, and project assignments"
```

---

## Chunk 3, Task 9: New Employee Page

**Files:**
- Create: `src/app/internal/employees/new/page.tsx`
- Create: `src/app/internal/employees/new/NewEmployeeForm.tsx`

- [ ] **Step 1: Create src/app/internal/employees/new/NewEmployeeForm.tsx**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewEmployeeForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    legalName: "", hireDate: "", employmentType: "W2", tradeClassification: "laborer",
    homeAddress: "", city: "", state: "NV", zip: "",
    ec1Name: "", ec1Relationship: "", ec1Phone: "",
    ec2Name: "", ec2Relationship: "", ec2Phone: "",
    driversLicenseNumber: "", driversLicenseExpiry: "",
  });

  const inputClass =
    "w-full bg-surface border border-border rounded-sm px-4 py-3 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent transition-colors";

  const set = (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const emp = await res.json();
      router.push(`/internal/employees/${emp.id}`);
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to save");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-2xl">
      <section>
        <h2 className="text-text-primary font-semibold mb-4">Contact Information</h2>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="First Name *" required value={form.firstName} onChange={set("firstName")} className={inputClass} />
            <input placeholder="Last Name" value={form.lastName} onChange={set("lastName")} className={inputClass} />
          </div>
          <input placeholder="Legal Name (as on ID) *" required value={form.legalName} onChange={set("legalName")} className={inputClass} />
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Email *" required type="email" value={form.email} onChange={set("email")} className={inputClass} />
            <input placeholder="Phone" value={form.phone} onChange={set("phone")} className={inputClass} />
          </div>
          <input placeholder="Home Address *" required value={form.homeAddress} onChange={set("homeAddress")} className={inputClass} />
          <div className="grid grid-cols-3 gap-3">
            <input placeholder="City *" required value={form.city} onChange={set("city")} className={inputClass} />
            <input placeholder="State *" required value={form.state} onChange={set("state")} className={inputClass} />
            <input placeholder="ZIP *" required value={form.zip} onChange={set("zip")} className={inputClass} />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-text-primary font-semibold mb-4">Employment Details</h2>
        <div className="flex flex-col gap-3">
          <input placeholder="Hire Date *" required type="date" value={form.hireDate} onChange={set("hireDate")} className={inputClass} />
          <div className="grid grid-cols-2 gap-3">
            <select required value={form.employmentType} onChange={set("employmentType")} className={`${inputClass} appearance-none`}>
              <option value="W2">W-2 Employee</option>
              <option value="CONTRACTOR_1099">1099 Contractor</option>
            </select>
            <select required value={form.tradeClassification} onChange={set("tradeClassification")} className={`${inputClass} appearance-none`}>
              <option value="laborer">Laborer</option>
              <option value="carpenter">Carpenter</option>
              <option value="electrician">Electrician</option>
              <option value="superintendent">Superintendent</option>
              <option value="pm">Project Manager</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Driver's License # (optional)" value={form.driversLicenseNumber} onChange={set("driversLicenseNumber")} className={inputClass} />
            <input placeholder="License Expiry (optional)" type="date" value={form.driversLicenseExpiry} onChange={set("driversLicenseExpiry")} className={inputClass} />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-text-primary font-semibold mb-4">Emergency Contact 1 <span className="text-red-400">*</span></h2>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Name *" required value={form.ec1Name} onChange={set("ec1Name")} className={inputClass} />
            <input placeholder="Relationship *" required value={form.ec1Relationship} onChange={set("ec1Relationship")} className={inputClass} />
          </div>
          <input placeholder="Phone *" required value={form.ec1Phone} onChange={set("ec1Phone")} className={inputClass} />
        </div>
      </section>

      <section>
        <h2 className="text-text-primary font-semibold mb-4">Emergency Contact 2 <span className="text-text-muted text-sm font-normal">(optional)</span></h2>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Name" value={form.ec2Name} onChange={set("ec2Name")} className={inputClass} />
            <input placeholder="Relationship" value={form.ec2Relationship} onChange={set("ec2Relationship")} className={inputClass} />
          </div>
          <input placeholder="Phone" value={form.ec2Phone} onChange={set("ec2Phone")} className={inputClass} />
        </div>
      </section>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-accent text-bg font-semibold px-6 py-3 rounded-sm text-sm hover:bg-accent/90 transition-colors disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Employee"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-text-muted text-sm hover:text-text-primary transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Create src/app/internal/employees/new/page.tsx**

```tsx
import NewEmployeeForm from "./NewEmployeeForm";

export default function NewEmployeePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-8">Add Employee</h1>
      <NewEmployeeForm />
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/internal/employees/new/
git commit -m "feat: add new employee form page"
```

---

## Chunk 3 Complete

Employee module is live: list page with compliance badges, detail page with certifications and onboarding status, new employee form, and full API coverage. Proceed to Chunk 4 (Certifications + File Upload).
