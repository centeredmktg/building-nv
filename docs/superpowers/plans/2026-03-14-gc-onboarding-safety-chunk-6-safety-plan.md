# GC Onboarding & Safety — Chunk 6: Project Safety Plan

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the per-project safety plan page (screen view + print view) that assembles emergency info, team phone tree, and site-specific hazard notes from live project data.

**Architecture:** Safety plan page is a server component. Print view is a separate `/print` route with `@media print` CSS — no PDF library. Emergency services (nearest ER) use manual entry in this phase (geocoding API integration is a future enhancement noted in spec Open Questions).

**Tech Stack:** Next.js 16, Prisma 7, TypeScript, Tailwind CSS 4

**Spec reference:** `docs/superpowers/specs/2026-03-14-gc-onboarding-safety-system-design.md` — Section 2d

**Prerequisites:** Chunk 5 committed (project has siteAddress, teamMembers).

---

## Chunk 6, Task 16: Safety Plan Data + Screen View

**Files:**
- Create: `src/app/internal/projects/[id]/safety-plan/page.tsx`
- Create: `src/app/internal/projects/[id]/safety-plan/EmergencyInfoForm.tsx`

- [ ] **Step 1: Create EmergencyInfoForm.tsx**

The safety plan needs local emergency info (nearest ER, etc.) that won't be in the project record. This form lets the superintendent fill it in and saves it back to the project via PATCH. We'll add two new optional fields to the Project PATCH: `nearestER` and `nearestERAddress`.

First, add these fields to the Project PATCH allowlist in `src/app/api/projects/[id]/route.ts`:

```typescript
// In the allowedFields array, add:
"nearestER", "nearestERAddress", "assemblyPoint",
```

Also add these fields to the Prisma schema (`prisma/schema.prisma`) in the Project model:

```prisma
  nearestER            String?
  nearestERAddress     String?
  assemblyPoint        String?
```

Then run:
```bash
npx prisma migrate dev --name add_project_safety_fields
```

Now create `EmergencyInfoForm.tsx`:

```tsx
"use client";

import { useState } from "react";

export default function EmergencyInfoForm({
  projectId,
  initial,
}: {
  projectId: string;
  initial: {
    nearestER: string | null;
    nearestERAddress: string | null;
    assemblyPoint: string | null;
  };
}) {
  const [form, setForm] = useState({
    nearestER: initial.nearestER ?? "",
    nearestERAddress: initial.nearestERAddress ?? "",
    assemblyPoint: initial.assemblyPoint ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const inputClass =
    "w-full bg-surface border border-border rounded-sm px-3 py-2 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent transition-colors";

  const set = (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <input
          placeholder="Nearest ER name (e.g. Renown Regional Medical)"
          value={form.nearestER}
          onChange={set("nearestER")}
          className={inputClass}
        />
        <input
          placeholder="ER address (e.g. 1155 Mill St, Reno NV)"
          value={form.nearestERAddress}
          onChange={set("nearestERAddress")}
          className={inputClass}
        />
      </div>
      <input
        placeholder="Assembly point (e.g. parking lot on north side of building)"
        value={form.assemblyPoint}
        onChange={set("assemblyPoint")}
        className={inputClass}
      />
      <button
        onClick={save}
        disabled={saving}
        className="self-start bg-accent text-bg font-semibold px-4 py-2 rounded-sm text-sm hover:bg-accent/90 transition-colors disabled:opacity-60"
      >
        {saving ? "Saving..." : saved ? "Saved ✓" : "Save Emergency Info"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create src/app/internal/projects/[id]/safety-plan/page.tsx**

```tsx
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
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ src/app/internal/projects/[id]/safety-plan/ src/app/api/projects/[id]/route.ts
git commit -m "feat: add project safety plan page with emergency info, team phone tree, and hazard notes"
```

---

## Chunk 6, Task 17: Safety Plan Print View

**Files:**
- Create: `src/app/internal/projects/[id]/safety-plan/print/page.tsx`
- Create: `src/app/internal/projects/[id]/safety-plan/print/PrintButton.tsx`

The print view is a bare HTML page with `@media print` styling. No navigation chrome. Opens in a new tab, user prints with Ctrl+P / Cmd+P.

Note: `window.print()` requires a `"use client"` component. The print page is a server component, so the button is extracted to a tiny client component.

Note: `complianceBadgeLabel` used in `safety-plan/page.tsx` is exported from `@/lib/employees` (defined in Chunk 2, Task 4). Verify the export is present before running `tsc --noEmit` in this chunk.

- [ ] **Step 1: Create PrintButton.tsx**

```tsx
// src/app/internal/projects/[id]/safety-plan/print/PrintButton.tsx
"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{ padding: "8px 16px", cursor: "pointer" }}
    >
      Print this page
    </button>
  );
}
```

- [ ] **Step 2: Create the print page**

```tsx
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

export default async function SafetyPlanPrintPage({
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
              certifications: { select: { type: true, verifiedStatus: true } },
            },
          },
        },
        orderBy: { role: "asc" },
      },
    },
  });

  if (!project) notFound();

  const siteAddress = project.siteAddress
    ? `${project.siteAddress}, ${project.siteCity}, ${project.siteState} ${project.siteZip}`
    : "Address not set";

  const generatedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const superintendent = project.teamMembers.find((m) => m.role === "superintendent");

  return (
    <div className="print-page">
      <style>{`
        @media print {
          body { margin: 0; font-family: Arial, sans-serif; font-size: 11pt; color: #000; }
          .no-print { display: none !important; }
          .print-page { padding: 0.75in; }
          h1 { font-size: 16pt; margin-bottom: 4pt; }
          h2 { font-size: 12pt; margin-top: 16pt; margin-bottom: 6pt; border-bottom: 1px solid #000; padding-bottom: 3pt; }
          table { width: 100%; border-collapse: collapse; font-size: 10pt; }
          th { text-align: left; font-weight: bold; border-bottom: 1px solid #000; padding: 4pt 0; }
          td { padding: 4pt 0; border-bottom: 1px solid #eee; vertical-align: top; }
          .meta { font-size: 10pt; color: #444; }
          .emergency-box { border: 2px solid #000; padding: 8pt; margin: 8pt 0; }
          .emergency-box h2 { border-bottom: none; margin-top: 0; }
          .bold { font-weight: bold; }
          .hazard-box { border: 1px solid #999; padding: 8pt; margin: 8pt 0; background: #f9f9f9; }
        }
        @media screen {
          .print-page { max-width: 800px; margin: 2rem auto; padding: 2rem; font-family: Arial, sans-serif; font-size: 14px; }
          h1 { font-size: 20px; }
          h2 { font-size: 14px; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 24px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 6px 0; border-bottom: 1px solid #eee; text-align: left; }
          .emergency-box { border: 2px solid #000; padding: 12px; margin: 12px 0; }
          .hazard-box { border: 1px solid #999; padding: 12px; background: #f9f9f9; }
          .no-print { margin-bottom: 1rem; }
        }
      `}</style>

      <div className="no-print" style={{ marginBottom: "1rem" }}>
        <PrintButton />
      </div>

      <h1>{project.name} — Job Site Safety Plan</h1>
      <p className="meta">
        Site: {siteAddress}<br />
        Generated: {generatedDate}<br />
        {superintendent && <>Superintendent: {superintendent.employee.legalName} · {superintendent.employee.contact.phone ?? "no phone"}</>}
      </p>

      <div className="emergency-box">
        <h2>EMERGENCY CONTACTS</h2>
        <table>
          <tbody>
            <tr><td className="bold">911</td><td>All life-threatening emergencies</td></tr>
            <tr><td className="bold">Poison Control</td><td>1-800-222-1222</td></tr>
            <tr><td className="bold">Nevada OSHA</td><td>(775) 688-3045</td></tr>
            {project.nearestER && (
              <tr>
                <td className="bold">Nearest ER</td>
                <td>{project.nearestER}{project.nearestERAddress ? ` — ${project.nearestERAddress}` : ""}</td>
              </tr>
            )}
            {project.assemblyPoint && (
              <tr><td className="bold">Assembly Point</td><td>{project.assemblyPoint}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h2>TEAM PHONE TREE</h2>
      {project.teamMembers.length === 0 ? (
        <p>No team members assigned.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Cell</th>
              <th>Emergency Contact</th>
            </tr>
          </thead>
          <tbody>
            {project.teamMembers.map((m) => (
              <tr key={m.id}>
                <td>{m.employee.legalName}</td>
                <td style={{ textTransform: "capitalize" }}>{m.role}</td>
                <td>{m.employee.contact.phone ?? "—"}</td>
                <td>{m.employee.ec1Name} ({m.employee.ec1Relationship}): {m.employee.ec1Phone}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {project.hazardNotes && (
        <>
          <h2>SITE-SPECIFIC HAZARDS</h2>
          <div className="hazard-box">
            <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{project.hazardNotes}</p>
          </div>
        </>
      )}
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
git add src/app/internal/projects/[id]/safety-plan/print/
git commit -m "feat: add safety plan print view (letter-size, binder-ready)"
```

---

## Chunk 6 Complete

Safety plan is live with both a screen view and a print view. Emergency info (ER, assembly point) is editable per project. Phone tree pulls live from team assignments. Proceed to Chunk 7 (Digital Onboarding Flow).
