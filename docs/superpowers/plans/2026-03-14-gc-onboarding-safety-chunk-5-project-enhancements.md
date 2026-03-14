# GC Onboarding & Safety — Chunk 5: Project Enhancements

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add site address fields and hazard notes to projects, build project team assignment (add/remove employees from a job site), and create a project detail page that surfaces all this information.

**Architecture:** Extends existing Project API route to handle new fields. New team assignment routes follow the same pattern as ProjectContact. Project detail page is a new server component — the existing `/internal/projects` page is the Kanban board and stays unchanged.

**Tech Stack:** Next.js 16, Prisma 7, TypeScript, Tailwind CSS 4

**Spec reference:** `docs/superpowers/specs/2026-03-14-gc-onboarding-safety-system-design.md` — Sections 2b (project team assignment), 2d (project safety plan data sources)

**Prerequisites:** Chunk 2 committed (schema has siteAddress, hazardNotes, teamMembers on Project).

---

## Chunk 5, Task 13: Extend Project API

**Files:**
- Modify: `src/app/api/projects/[id]/route.ts`

The existing PATCH handler only handles `stage` and `notes`. Extend it to also accept site address fields and `hazardNotes`.

- [ ] **Step 1: Update src/app/api/projects/[id]/route.ts**

Replace the full file:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      projectContacts: { include: { contact: true } },
      projectCompanies: { include: { company: true } },
      quotes: { select: { id: true, title: true, status: true, address: true } },
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

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(project);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const allowedFields = [
    "stage", "notes", "hazardNotes",
    "siteAddress", "siteCity", "siteState", "siteZip",
  ];

  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) data[field] = body[field];
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const project = await prisma.project.update({ where: { id }, data });
  return NextResponse.json(project);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/projects/[id]/route.ts
git commit -m "feat: extend project API with GET detail, site address, and hazard notes"
```

---

## Chunk 5, Task 14: Project Team Assignment API

**Files:**
- Create: `src/app/api/projects/[id]/team/route.ts`
- Create: `src/app/api/projects/[id]/team/[memberId]/route.ts`

- [ ] **Step 1: Create src/app/api/projects/[id]/team/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const members = await prisma.projectTeamMember.findMany({
    where: { projectId },
    include: {
      employee: {
        include: {
          contact: { select: { firstName: true, lastName: true, phone: true } },
          certifications: { select: { type: true, verifiedStatus: true, expirationDate: true } },
        },
      },
    },
  });
  return NextResponse.json(members);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const { employeeId, role } = await req.json() as { employeeId: string; role?: string };

  if (!employeeId) {
    return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
  }

  // Verify employee exists and is active
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  if (employee.activeStatus === "terminated") {
    return NextResponse.json({ error: "Cannot assign terminated employee to project" }, { status: 400 });
  }

  const member = await prisma.projectTeamMember.create({
    data: { projectId, employeeId, role: role ?? "worker" },
    include: {
      employee: {
        include: { contact: { select: { firstName: true, lastName: true, phone: true } } },
      },
    },
  });

  return NextResponse.json(member, { status: 201 });
}
```

- [ ] **Step 2: Create src/app/api/projects/[id]/team/[memberId]/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { memberId } = await params;
  await prisma.projectTeamMember.delete({ where: { id: memberId } });
  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { memberId } = await params;
  const { role } = await req.json() as { role: string };
  if (!role) return NextResponse.json({ error: "role is required" }, { status: 400 });

  const member = await prisma.projectTeamMember.update({
    where: { id: memberId },
    data: { role },
  });
  return NextResponse.json(member);
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/projects/[id]/team/
git commit -m "feat: add project team assignment API (assign/remove/update employees on projects)"
```

---

## Chunk 5, Task 15: Project Detail Page

**Files:**
- Create: `src/app/internal/projects/[id]/page.tsx`
- Create: `src/app/internal/projects/[id]/ProjectSiteForm.tsx`
- Create: `src/app/internal/projects/[id]/TeamAssignmentPanel.tsx`

- [ ] **Step 1: Create ProjectSiteForm.tsx**

Client component to edit site address and hazard notes inline:

```tsx
"use client";

import { useState } from "react";

interface SiteFormProps {
  projectId: string;
  initial: {
    siteAddress: string | null;
    siteCity: string | null;
    siteState: string | null;
    siteZip: string | null;
    hazardNotes: string | null;
  };
}

export default function ProjectSiteForm({ projectId, initial }: SiteFormProps) {
  const [form, setForm] = useState({
    siteAddress: initial.siteAddress ?? "",
    siteCity: initial.siteCity ?? "",
    siteState: initial.siteState ?? "NV",
    siteZip: initial.siteZip ?? "",
    hazardNotes: initial.hazardNotes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const inputClass =
    "w-full bg-surface border border-border rounded-sm px-3 py-2 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent transition-colors";

  const set = (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
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
      <input placeholder="Site Address" value={form.siteAddress} onChange={set("siteAddress")} className={inputClass} />
      <div className="grid grid-cols-3 gap-2">
        <input placeholder="City" value={form.siteCity} onChange={set("siteCity")} className={inputClass} />
        <input placeholder="State" value={form.siteState} onChange={set("siteState")} className={inputClass} />
        <input placeholder="ZIP" value={form.siteZip} onChange={set("siteZip")} className={inputClass} />
      </div>
      <textarea
        placeholder="Site-specific hazards (e.g. asbestos suspected, unstable soil, high voltage nearby)"
        rows={3}
        value={form.hazardNotes}
        onChange={set("hazardNotes")}
        className={`${inputClass} resize-none`}
      />
      <button
        onClick={save}
        disabled={saving}
        className="self-start bg-accent text-bg font-semibold px-4 py-2 rounded-sm text-sm hover:bg-accent/90 transition-colors disabled:opacity-60"
      >
        {saving ? "Saving..." : saved ? "Saved ✓" : "Save Site Info"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create TeamAssignmentPanel.tsx**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Employee {
  id: string;
  legalName: string;
  tradeClassification: string;
  contact: { firstName: string; lastName: string; phone: string | null };
}

interface TeamMember {
  id: string;
  role: string;
  employee: Employee & {
    certifications: { type: string; verifiedStatus: string }[];
  };
}

export default function TeamAssignmentPanel({
  projectId,
  initialMembers,
  availableEmployees,
}: {
  projectId: string;
  initialMembers: TeamMember[];
  availableEmployees: Employee[];
}) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [selectedId, setSelectedId] = useState("");
  const [selectedRole, setSelectedRole] = useState("worker");
  const [adding, setAdding] = useState(false);

  const unassigned = availableEmployees.filter(
    (e) => !members.some((m) => m.employee.id === e.id)
  );

  const addMember = async () => {
    if (!selectedId) return;
    setAdding(true);
    const res = await fetch(`/api/projects/${projectId}/team`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId: selectedId, role: selectedRole }),
    });
    if (res.ok) {
      router.refresh();
    }
    setAdding(false);
    setSelectedId("");
  };

  const removeMember = async (memberId: string) => {
    await fetch(`/api/projects/${projectId}/team/${memberId}`, { method: "DELETE" });
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
  };

  const selectClass =
    "bg-surface border border-border rounded-sm px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-accent transition-colors appearance-none";

  return (
    <div>
      {members.length > 0 && (
        <div className="flex flex-col gap-2 mb-4">
          {members.map((m) => {
            const hasOsha = m.employee.certifications.some(
              (c) => (c.type === "OSHA_10" || c.type === "OSHA_30") && c.verifiedStatus === "verified"
            );
            return (
              <div key={m.id} className="flex items-center justify-between border border-border rounded-sm px-4 py-3">
                <div>
                  <p className="text-text-primary text-sm font-medium">{m.employee.legalName}</p>
                  <p className="text-text-muted text-xs">
                    {m.role} · {m.employee.contact.phone ?? "no phone"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {!hasOsha && (
                    <span className="text-xs text-yellow-400">No OSHA cert</span>
                  )}
                  <button
                    onClick={() => removeMember(m.id)}
                    className="text-text-muted text-xs hover:text-red-400 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {unassigned.length > 0 && (
        <div className="flex gap-2">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className={`flex-1 ${selectClass}`}
          >
            <option value="">Select employee to assign...</option>
            {unassigned.map((e) => (
              <option key={e.id} value={e.id}>
                {e.legalName} — {e.tradeClassification}
              </option>
            ))}
          </select>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className={selectClass}
          >
            <option value="worker">Worker</option>
            <option value="foreman">Foreman</option>
            <option value="superintendent">Superintendent</option>
          </select>
          <button
            onClick={addMember}
            disabled={!selectedId || adding}
            className="bg-accent text-bg font-semibold px-4 py-2 rounded-sm text-sm hover:bg-accent/90 transition-colors disabled:opacity-60"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create src/app/internal/projects/[id]/page.tsx**

```tsx
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProjectSiteForm from "./ProjectSiteForm";
import TeamAssignmentPanel from "./TeamAssignmentPanel";

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
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors. Fix any type mismatches in the `TeamAssignmentPanel` props cast.

- [ ] **Step 5: Commit**

```bash
git add src/app/internal/projects/[id]/
git commit -m "feat: add project detail page with site info, team assignment, and nav to safety plan"
```

---

## Chunk 5 Complete

Projects now have site address, hazard notes, and a team assignment UI. The project detail page links to the safety plan and print binder. Proceed to Chunk 6 (Project Safety Plan).
