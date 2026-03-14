# GC Onboarding & Safety — Chunk 8: SDS Extension + Print Templates

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SDS fields to the Component Catalog, surface per-project SDS checklists, and build all print templates (job site binder, phone tree, employee profile sheet).

**Architecture:** Component model gets `sdsUrl` and `isHazardous` (already in schema from Chunk 2). Per-project SDS list is derived by joining project quotes → line items → components where `isHazardous = true`. All print templates use `@media print` CSS — no PDF library.

**Tech Stack:** Next.js 16, Prisma 7, TypeScript, Tailwind CSS 4

**Spec reference:** `docs/superpowers/specs/2026-03-14-gc-onboarding-safety-system-design.md` — Sections 2f, 2g

**Prerequisites:**
- Chunk 2 committed (schema has `sdsUrl` and `isHazardous` on Component; `formatEmployeeName` and `complianceBadgeLabel` exported from `@/lib/employees`)
- Chunk 6 committed — the binder print page references `project.nearestER`, `project.nearestERAddress`, and `project.assemblyPoint`, which are added by Chunk 6's migration. Do not execute Task 22a before Chunk 6 is fully committed and migrated.

---

## Chunk 8, Task 21: SDS Component Extension

**Files:**
- Modify: `src/app/api/components/route.ts`
- Modify: `src/app/api/components/[id]/route.ts`
- Modify: `src/app/internal/components/new/NewComponentForm.tsx`
- Modify: `src/app/internal/components/page.tsx`

- [ ] **Step 1: Update POST in src/app/api/components/route.ts**

Add `sdsUrl` and `isHazardous` to the create handler. In the existing POST, update the destructuring and `prisma.component.create` call:

```typescript
// Add to destructuring:
const { name, description, category, vendorSku, vendorCost, unit, vendorId, sdsUrl, isHazardous } =
  await req.json();

// Add to prisma.component.create data:
sdsUrl: sdsUrl?.trim() || null,
isHazardous: isHazardous === true,
```

- [ ] **Step 2: Update or create src/app/api/components/[id]/route.ts**

Add a PATCH handler for updating individual components (needed to add SDS after creation):

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const component = await prisma.component.findUnique({
    where: { id },
    include: { vendor: { select: { id: true, name: true } } },
  });
  if (!component) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(component);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const allowedFields = [
    "name", "description", "category", "vendorSku", "vendorCost",
    "unit", "vendorId", "sdsUrl", "isHazardous",
  ];

  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      if (field === "vendorCost") {
        data[field] = parseFloat(body[field]);
      } else if (field === "isHazardous") {
        data[field] = body[field] === true;
      } else {
        data[field] = body[field];
      }
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const component = await prisma.component.update({ where: { id }, data });
  return NextResponse.json(component);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.component.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Update NewComponentForm.tsx to include SDS fields**

In `src/app/internal/components/new/NewComponentForm.tsx`, add to the form state:
```typescript
sdsUrl: "", isHazardous: false,
```

Add SDS fields before the submit button:
```tsx
<div className="flex items-center gap-3">
  <input
    type="checkbox"
    id="isHazardous"
    checked={form.isHazardous as unknown as boolean}
    onChange={(e) => setForm((p) => ({ ...p, isHazardous: e.target.checked }))}
  />
  <label htmlFor="isHazardous" className="text-text-muted text-sm cursor-pointer">
    This is a hazardous material (requires SDS on job site)
  </label>
</div>
{(form.isHazardous as unknown as boolean) && (
  <input
    placeholder="SDS URL (manufacturer link or upload URL)"
    value={form.sdsUrl as string}
    onChange={set("sdsUrl")}
    className={inputClass}
  />
)}
```

Update the fetch body to include the new fields:
```typescript
body: JSON.stringify({
  ...form,
  vendorCost: parseFloat(form.vendorCost),
  isHazardous: form.isHazardous,
  sdsUrl: (form.sdsUrl as string) || null,
}),
```

- [ ] **Step 4: Update ComponentsPage to show hazard indicator**

In `src/app/internal/components/page.tsx`, in the component row, add after the vendor name:
```tsx
{c.isHazardous && (
  <span className="text-xs text-yellow-400 ml-2">⚠ Hazardous</span>
)}
```

And add SDS link if present:
```tsx
{c.sdsUrl && (
  <a
    href={c.sdsUrl}
    target="_blank"
    rel="noopener noreferrer"
    className="text-accent text-xs hover:underline ml-2"
  >
    SDS
  </a>
)}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/components/ src/app/internal/components/
git commit -m "feat: add SDS URL and hazardous flag to Component Catalog"
```

---

## Chunk 8, Task 22: Print Templates

**Files:**
- Create: `src/app/internal/projects/[id]/binder/print/page.tsx`
- Create: `src/app/internal/projects/[id]/phone-tree/print/page.tsx`
- Create: `src/app/internal/employees/[id]/print/page.tsx`

---

### Sub-task 22a: Job Site Binder

- [ ] **Step 1: Create binder print page**

```tsx
// src/app/internal/projects/[id]/binder/print/page.tsx
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function BinderPrintPage({
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
            },
          },
        },
        orderBy: { role: "asc" },
      },
      quotes: {
        include: {
          sections: {
            include: {
              items: {
                include: {
                  component: { select: { name: true, sdsUrl: true, isHazardous: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!project) notFound();

  const siteAddress = project.siteAddress
    ? `${project.siteAddress}, ${project.siteCity}, ${project.siteState} ${project.siteZip}`
    : "Address not set";

  const superintendent = project.teamMembers.find((m) => m.role === "superintendent");
  const generatedDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  // Derive hazardous materials from quote line items
  const hazardousMaterials = project.quotes.flatMap((q) =>
    q.sections.flatMap((s) =>
      s.items
        .filter((i) => i.component?.isHazardous)
        .map((i) => ({
          name: i.component!.name,
          sdsUrl: i.component!.sdsUrl,
          description: i.description,
        }))
    )
  );
  // Deduplicate by name
  const uniqueHazardous = Array.from(
    new Map(hazardousMaterials.map((m) => [m.name, m])).values()
  );

  // Line items without a linked component (manual entries) — flag for manual SDS verification
  const unlinkedItems = project.quotes.flatMap((q) =>
    q.sections.flatMap((s) =>
      s.items.filter((i) => !i.component).map((i) => i.description)
    )
  );

  const printStyle = `
    @media print {
      body { margin: 0; font-family: Arial, sans-serif; font-size: 11pt; color: #000; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
      .print-page { padding: 0.75in; }
      h1 { font-size: 16pt; }
      h2 { font-size: 13pt; margin-top: 20pt; border-bottom: 1.5px solid #000; padding-bottom: 4pt; }
      h3 { font-size: 11pt; margin-top: 14pt; }
      table { width: 100%; border-collapse: collapse; }
      th { text-align: left; border-bottom: 1px solid #000; padding: 4pt 0; font-size: 10pt; }
      td { padding: 4pt 0; border-bottom: 1px solid #eee; vertical-align: top; font-size: 10pt; }
      .box { border: 2px solid #000; padding: 8pt; margin: 8pt 0; }
      .warning-box { border: 1px solid #999; padding: 8pt; background: #f5f5f5; }
      ul { margin: 4pt 0; padding-left: 16pt; }
      li { margin: 2pt 0; }
    }
    @media screen {
      .print-page { max-width: 850px; margin: 2rem auto; padding: 2rem; font-family: Arial, sans-serif; }
      h1 { font-size: 22px; }
      h2 { font-size: 16px; border-bottom: 1px solid #ccc; padding-bottom: 6px; margin-top: 28px; }
      h3 { font-size: 13px; margin-top: 16px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 6px 0; border-bottom: 1px solid #eee; text-align: left; }
      .box { border: 2px solid #000; padding: 12px; margin: 12px 0; }
      .warning-box { border: 1px solid #999; padding: 12px; background: #f9f9f9; }
    }
  `;

  return (
    <div className="print-page">
      <style>{printStyle}</style>

      <div className="no-print" style={{ marginBottom: "1rem" }}>
        <button onClick={() => window.print()} style={{ padding: "8px 16px", cursor: "pointer" }}>
          Print Binder
        </button>
      </div>

      {/* Cover page */}
      <h1>{project.name}</h1>
      <h2 style={{ borderBottom: "none", marginTop: "4pt" }}>JOB SITE SAFETY BINDER</h2>
      <p style={{ fontSize: "11pt", color: "#444" }}>
        Site: {siteAddress}<br />
        Generated: {generatedDate}<br />
        {superintendent && <>Superintendent: {superintendent.employee.legalName} · {superintendent.employee.contact.phone ?? "no phone"}</>}
      </p>

      {/* Emergency contacts */}
      <div className="box" style={{ marginTop: "24pt" }}>
        <h2 style={{ marginTop: 0, borderBottom: "none" }}>EMERGENCY CONTACTS</h2>
        <table>
          <tbody>
            <tr><td><strong>911</strong></td><td>All life-threatening emergencies</td></tr>
            <tr><td><strong>Poison Control</strong></td><td>1-800-222-1222</td></tr>
            <tr><td><strong>Nevada OSHA</strong></td><td>(775) 688-3045</td></tr>
            {project.nearestER && (
              <tr>
                <td><strong>Nearest ER</strong></td>
                <td>{project.nearestER}{project.nearestERAddress ? ` — ${project.nearestERAddress}` : ""}</td>
              </tr>
            )}
            {project.assemblyPoint && (
              <tr><td><strong>Assembly Point</strong></td><td>{project.assemblyPoint}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Phone tree */}
      <h2>TEAM PHONE TREE</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th><th>Role</th><th>Cell</th><th>Emergency Contact</th>
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

      {/* Site hazards */}
      {project.hazardNotes && (
        <>
          <h2>SITE-SPECIFIC HAZARDS</h2>
          <div className="warning-box">
            <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{project.hazardNotes}</p>
          </div>
        </>
      )}

      {/* SDS checklist */}
      <div className="page-break" />
      <h2>SDS (SAFETY DATA SHEET) CHECKLIST</h2>
      <p style={{ fontSize: "10pt" }}>
        The following hazardous materials are associated with this project. Confirm the SDS for each is in the site binder before work begins.
      </p>
      {uniqueHazardous.length === 0 ? (
        <p style={{ fontSize: "10pt", color: "#666" }}>
          No hazardous materials flagged in this project's quotes. If hazardous materials are in use, flag them in the Component Catalog.
        </p>
      ) : (
        <table>
          <thead>
            <tr><th>Material</th><th>SDS Available</th><th>Confirmed in Binder</th></tr>
          </thead>
          <tbody>
            {uniqueHazardous.map((m) => (
              <tr key={m.name}>
                <td>{m.name}</td>
                <td>{m.sdsUrl ? <a href={m.sdsUrl} target="_blank" rel="noopener noreferrer">View SDS</a> : "Upload needed"}</td>
                <td style={{ width: "120pt" }}>☐ Confirmed</td>
              </tr>
            ))}
            {unlinkedItems.map((desc, i) => (
              <tr key={`unlinked-${i}`} style={{ color: "#888" }}>
                <td>{desc} <em>(manual entry)</em></td>
                <td>Verify SDS manually</td>
                <td>☐ Confirmed</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Key safety policy excerpts */}
      <div className="page-break" />
      <h2>SAFETY POLICY QUICK REFERENCE</h2>
      <h3>Fall Protection</h3>
      <ul>
        <li>Fall protection required for all work at 6 feet or higher above a lower level (OSHA 1926 Subpart M)</li>
        <li>Acceptable systems: guardrails, personal fall arrest systems (PFAS), safety nets</li>
        <li>Holes and floor openings must be covered and labeled</li>
      </ul>
      <h3>PPE — Minimum Required on All Sites</h3>
      <ul>
        <li>Hard hat (ANSI Z89.1 Class E)</li>
        <li>Safety glasses (ANSI Z87.1)</li>
        <li>Steel-toed boots</li>
      </ul>
      <h3>Heat Illness Prevention (Nevada NAC 618)</h3>
      <ul>
        <li>1 quart of cool water per worker per hour</li>
        <li>Shade required when temperature reaches 80°F</li>
        <li>10-minute cool-down rest available upon request — never denied</li>
        <li>Heat stroke (103°F+ body temp, no sweating, confusion): call 911 immediately</li>
      </ul>
      <h3>Incident Reporting</h3>
      <ul>
        <li>Report ALL incidents to superintendent immediately</li>
        <li>Fatality: report to OSHA within 8 hours</li>
        <li>Hospitalization / amputation / loss of eye: report to Nevada OSHA within 24 hours: (775) 688-3045</li>
        <li>Complete Incident Report Form within 24 hours (blank form on next page)</li>
      </ul>

      {/* Blank incident report form */}
      <div className="page-break" />
      <h2>INCIDENT REPORT FORM</h2>
      <p style={{ fontSize: "10pt", color: "#666" }}>Complete within 24 hours of any incident. Submit to superintendent.</p>
      <table style={{ marginTop: "12pt" }}>
        <tbody>
          {[
            "Date / Time of Incident:",
            "Location (address + specific area):",
            "Person(s) Involved (name, role):",
            "Witnesses (name, contact):",
            "Description of Incident:",
            "Immediate Cause:",
            "Contributing Factors:",
            "Injury / Illness (if any):",
            "Medical Treatment Required?",
            "Corrective Action Taken:",
            "Reported to Superintendent (name, date/time):",
            "Reported to OSHA? (if required):",
          ].map((field) => (
            <tr key={field} style={{ height: "32pt" }}>
              <td style={{ width: "200pt", verticalAlign: "top", fontWeight: "bold", fontSize: "10pt", paddingTop: "6pt" }}>{field}</td>
              <td style={{ borderBottom: "1px solid #000" }}></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: "10pt", marginTop: "12pt" }}>
        Superintendent Signature: _________________________ Date: _____________
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/internal/projects/[id]/binder/
git commit -m "feat: add job site binder print template with SDS checklist and safety quick reference"
```

---

### Sub-task 22b: Phone Tree Print

- [ ] **Step 4: Create phone tree print page**

```tsx
// src/app/internal/projects/[id]/phone-tree/print/page.tsx
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PhoneTreePrintPage({
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
            },
          },
        },
        orderBy: { role: "asc" },
      },
    },
  });

  if (!project) notFound();

  const generatedDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div style={{ maxWidth: "700px", margin: "2rem auto", padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      <style>{`
        @media print {
          body { margin: 0; font-family: Arial, sans-serif; }
          div { max-width: none !important; margin: 0 !important; padding: 0.75in !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print" style={{ marginBottom: "1rem" }}>
        <button onClick={() => window.print()} style={{ padding: "8px 16px", cursor: "pointer" }}>Print</button>
      </div>

      <h1 style={{ fontSize: "18px", marginBottom: "4px" }}>{project.name}</h1>
      <p style={{ fontSize: "12px", color: "#666", marginBottom: "20px" }}>
        Emergency Phone Tree · Generated {generatedDate}
      </p>

      <p style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "4px" }}>EMERGENCY: 911</p>
      <p style={{ fontSize: "12px", color: "#666", marginBottom: "20px" }}>Poison Control: 1-800-222-1222 · Nevada OSHA: (775) 688-3045</p>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #000" }}>
            <th style={{ textAlign: "left", padding: "6px 0" }}>Name</th>
            <th style={{ textAlign: "left", padding: "6px 0" }}>Role</th>
            <th style={{ textAlign: "left", padding: "6px 0" }}>Cell</th>
            <th style={{ textAlign: "left", padding: "6px 0" }}>Emergency Contact</th>
          </tr>
        </thead>
        <tbody>
          {project.teamMembers.map((m) => (
            <tr key={m.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "6px 0" }}>{m.employee.legalName}</td>
              <td style={{ padding: "6px 0", textTransform: "capitalize" }}>{m.role}</td>
              <td style={{ padding: "6px 0" }}>{m.employee.contact.phone ?? "—"}</td>
              <td style={{ padding: "6px 0" }}>
                {m.employee.ec1Name} ({m.employee.ec1Relationship})<br />
                <span style={{ color: "#444" }}>{m.employee.ec1Phone}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/internal/projects/[id]/phone-tree/
git commit -m "feat: add phone tree print template"
```

---

### Sub-task 22c: Employee Profile Print

- [ ] **Step 6: Create employee profile print page**

```tsx
// src/app/internal/employees/[id]/print/page.tsx
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatEmployeeName } from "@/lib/employees";

export const dynamic = "force-dynamic";

export default async function EmployeeProfilePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      contact: true,
      certifications: { orderBy: { issueDate: "desc" } },
    },
  });

  if (!employee) notFound();

  const name = formatEmployeeName({
    legalName: employee.legalName,
    firstName: employee.contact.firstName,
    lastName: employee.contact.lastName,
  });

  const generatedDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div style={{ maxWidth: "700px", margin: "2rem auto", padding: "2rem", fontFamily: "Arial, sans-serif", fontSize: "12px" }}>
      <style>{`
        @media print {
          body { margin: 0; font-family: Arial, sans-serif; font-size: 11pt; }
          div { max-width: none !important; margin: 0 !important; padding: 0.75in !important; }
          .no-print { display: none !important; }
          table { width: 100%; border-collapse: collapse; }
          td { padding: 4pt 8pt 4pt 0; vertical-align: top; }
          .label { color: #666; width: 160pt; }
          h2 { font-size: 12pt; border-bottom: 1px solid #000; padding-bottom: 4pt; margin-top: 16pt; }
        }
        @media screen {
          table { width: 100%; border-collapse: collapse; }
          td { padding: 5px 10px 5px 0; vertical-align: top; }
          .label { color: #666; width: 160px; }
          h2 { border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 20px; }
        }
      `}</style>

      <div className="no-print" style={{ marginBottom: "1rem" }}>
        <button onClick={() => window.print()} style={{ padding: "8px 16px", cursor: "pointer" }}>Print</button>
      </div>

      <h1 style={{ fontSize: "18px", marginBottom: "2px" }}>{name}</h1>
      <p style={{ color: "#666", marginBottom: "16px", fontSize: "11px" }}>
        Employee Profile · Generated {generatedDate}
      </p>

      <h2>Employment</h2>
      <table>
        <tbody>
          <tr><td className="label">Trade</td><td style={{ textTransform: "capitalize" }}>{employee.tradeClassification}</td></tr>
          <tr><td className="label">Type</td><td>{employee.employmentType === "W2" ? "W-2 Employee" : "1099 Contractor"}</td></tr>
          <tr><td className="label">Status</td><td style={{ textTransform: "capitalize" }}>{employee.activeStatus}</td></tr>
          <tr><td className="label">Hire Date</td><td>{employee.hireDate.toLocaleDateString()}</td></tr>
          <tr><td className="label">Email</td><td>{employee.contact.email}</td></tr>
          <tr><td className="label">Phone</td><td>{employee.contact.phone ?? "—"}</td></tr>
        </tbody>
      </table>

      <h2>Address</h2>
      <p style={{ margin: "4px 0" }}>
        {employee.homeAddress}<br />
        {employee.city}, {employee.state} {employee.zip}
      </p>

      <h2>Emergency Contacts</h2>
      <table>
        <tbody>
          <tr>
            <td className="label">Primary</td>
            <td>{employee.ec1Name} ({employee.ec1Relationship}) · {employee.ec1Phone}</td>
          </tr>
          {employee.ec2Name && (
            <tr>
              <td className="label">Secondary</td>
              <td>{employee.ec2Name} ({employee.ec2Relationship}) · {employee.ec2Phone}</td>
            </tr>
          )}
        </tbody>
      </table>

      {employee.certifications.length > 0 && (
        <>
          <h2>Certifications</h2>
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #000", padding: "4px 0" }}>Type</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #000", padding: "4px 0" }}>Issued</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #000", padding: "4px 0" }}>Expires</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #000", padding: "4px 0" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {employee.certifications.map((c) => (
                <tr key={c.id}>
                  <td>{c.type.replace("_", " ")}</td>
                  <td>{c.issueDate.toLocaleDateString()}</td>
                  <td>{c.expirationDate?.toLocaleDateString() ?? "No Expiry"}</td>
                  <td style={{ textTransform: "capitalize" }}>{c.verifiedStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <p style={{ marginTop: "32px", fontSize: "10px", color: "#999" }}>
        Confidential — For authorized use only. Retain in employee personnel file.
      </p>
    </div>
  );
}
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit all**

```bash
git add src/app/internal/employees/[id]/print/ src/app/internal/projects/[id]/phone-tree/
git commit -m "feat: add employee profile print and phone tree print templates"
```

---

## Chunk 8 Complete — All Chunks Complete

The full GC Onboarding & Safety system is implemented:

- ✅ Chunk 1: Safety Manual + Onboarding Workbook (compliance documents)
- ✅ Chunk 2: Schema + Foundation (Employee model, types, nav)
- ✅ Chunk 3: Employee Module (list, detail, new)
- ✅ Chunk 4: Certifications + Vercel Blob upload
- ✅ Chunk 5: Project enhancements (site address, team assignment, detail page)
- ✅ Chunk 6: Project Safety Plan (screen + print)
- ✅ Chunk 7: Digital Onboarding Flow (invite → email → 8-step flow)
- ✅ Chunk 8: SDS extension + all print templates (binder, phone tree, employee profile)
