# Lead CRM Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full lead-to-project CRM backend for Building NV — inbound form creates/deduplicates contacts and companies, stores a project in Postgres, sends email via Resend, and surfaces everything in a kanban admin at `/admin`.

**Architecture:** The contact form submits multipart/form-data to `/api/contact`. The route upserts contact (by email) and company (by domain, with consumer domain exclusions), creates a project, links them via join tables, uploads any attachment to Supabase Storage, and sends a Resend email to `bids@buildingnv.com`. The `/admin` kanban is a server-rendered Next.js page with dnd-kit drag-and-drop and a slide-out detail panel.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + Storage), Resend, @dnd-kit/core, @dnd-kit/utilities, jose.

---

## Prerequisites (manual steps before running tasks)

1. Create a Supabase project at https://supabase.com — free tier is sufficient
2. Run the schema SQL from Task 1 in the Supabase SQL editor
3. In Supabase Storage, create a **public** bucket named `project-attachments`
4. Create a Resend account at https://resend.com, verify your sending domain, get an API key
5. Create `.env.local` in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
RESEND_API_KEY=re_your_key
ADMIN_PASSWORD=choose-a-strong-password
ADMIN_JWT_SECRET=choose-a-random-32-char-string
```

---

## Task 1: Database Schema

**Files:**
- Reference only — run in Supabase SQL editor

**Step 1: Run schema SQL**

```sql
-- Companies
CREATE TABLE companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'customer',
  domain text UNIQUE,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Contacts
CREATE TABLE contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text,
  email text UNIQUE NOT NULL,
  phone text,
  type text NOT NULL DEFAULT 'customer',
  primary_company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Projects
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  stage text NOT NULL DEFAULT 'opportunity_identified',
  project_type text,
  message text,
  notes text,
  attachment_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Join tables
CREATE TABLE project_contacts (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'customer',
  PRIMARY KEY (project_id, contact_id)
);

CREATE TABLE project_companies (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'customer',
  PRIMARY KEY (project_id, company_id)
);

-- Enable RLS (server uses service role key, so RLS blocks direct client access)
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_companies ENABLE ROW LEVEL SECURITY;
```

**Step 2: Verify in Supabase Table Editor**

Confirm all 5 tables exist with correct columns.

---

## Task 2: Install Dependencies

**Step 1: Install packages**

```bash
npm install @supabase/supabase-js resend @dnd-kit/core @dnd-kit/utilities jose
```

**Step 2: Verify**

```bash
node -e "require('@supabase/supabase-js'); require('resend'); console.log('ok')"
```

Expected: `ok`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install supabase, resend, dnd-kit, jose"
```

---

## Task 3: Shared Types and Utilities

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/supabase.ts`
- Create: `src/lib/domains.ts`

**Step 1: Create types**

```typescript
// src/lib/types.ts
export const STAGES = [
  { id: "opportunity_identified", label: "Opportunity Identified" },
  { id: "quote_requested",        label: "Quote Requested" },
  { id: "bid_delivered",          label: "Bid Delivered" },
  { id: "contract_completed",     label: "Contract Completed" },
  { id: "contract_sent",          label: "Contract Sent" },
  { id: "contract_signed",        label: "Contract Signed" },
  { id: "closed_lost",            label: "Closed Lost" },
] as const;

export type StageId = (typeof STAGES)[number]["id"];

export interface Company {
  id: string;
  name: string;
  type: string;
  domain: string | null;
  phone: string | null;
  created_at: string;
}

export interface Contact {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  phone: string | null;
  type: string;
  primary_company_id: string | null;
  created_at: string;
}

export interface ProjectContact {
  role: string;
  contact: Contact;
}

export interface ProjectCompany {
  role: string;
  company: Company;
}

export interface Project {
  id: string;
  name: string;
  stage: StageId;
  project_type: string | null;
  message: string | null;
  notes: string | null;
  attachment_url: string | null;
  created_at: string;
  updated_at: string;
  project_contacts: ProjectContact[];
  project_companies: ProjectCompany[];
}
```

**Step 2: Create Supabase client utility**

```typescript
// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

**Step 3: Create domain exclusion utility**

```typescript
// src/lib/domains.ts
const CONSUMER_DOMAINS = new Set([
  "gmail.com", "googlemail.com",
  "outlook.com", "hotmail.com", "hotmail.co.uk", "live.com",
  "yahoo.com", "yahoo.co.uk",
  "icloud.com", "me.com", "mac.com",
  "aol.com",
  "protonmail.com", "pm.me",
]);

export function extractBusinessDomain(email: string): string | null {
  const parts = email.toLowerCase().split("@");
  if (parts.length !== 2) return null;
  const domain = parts[1];
  return CONSUMER_DOMAINS.has(domain) ? null : domain;
}

export function splitName(fullName: string): { first: string; last: string | null } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: null };
  const last = parts.pop()!;
  return { first: parts.join(" "), last };
}
```

**Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no output.

**Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/supabase.ts src/lib/domains.ts
git commit -m "feat: add shared types, Supabase client, and domain utilities"
```

---

## Task 4: Update /api/contact Route

**Files:**
- Modify: `src/app/api/contact/route.ts`

**Step 1: Replace the contact route**

```typescript
// src/app/api/contact/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { extractBusinessDomain, splitName } from "@/lib/domains";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const formData = await req.formData();

  const fullName   = (formData.get("name") as string | null)?.trim() ?? "";
  const email      = (formData.get("email") as string | null)?.trim().toLowerCase() ?? "";
  const companyName = (formData.get("company") as string | null)?.trim() ?? "";
  const phone      = (formData.get("phone") as string | null)?.trim() ?? "";
  const projectType = formData.get("projectType") as string | null;
  const message    = formData.get("message") as string | null;
  const file       = formData.get("attachment") as File | null;

  if (!fullName || !phone || !email) {
    return NextResponse.json({ error: "Name, email, and phone are required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { first, last } = splitName(fullName);
  const domain = extractBusinessDomain(email);

  // Upsert company (only if business domain)
  let companyId: string | null = null;
  if (domain) {
    const { data: company } = await supabase
      .from("companies")
      .upsert(
        { name: companyName || domain, type: "customer", domain },
        { onConflict: "domain", ignoreDuplicates: false }
      )
      .select("id")
      .single();
    companyId = company?.id ?? null;
  }

  // Upsert contact
  const { data: contact } = await supabase
    .from("contacts")
    .upsert(
      {
        first_name: first,
        last_name: last,
        email,
        phone: phone || null,
        type: "customer",
        primary_company_id: companyId,
      },
      { onConflict: "email", ignoreDuplicates: false }
    )
    .select("id")
    .single();

  if (!contact) {
    return NextResponse.json({ error: "Failed to save contact" }, { status: 500 });
  }

  // Create project
  const projectName = companyName
    ? `${projectType ?? "Project"} — ${companyName}`
    : `${projectType ?? "Project"} — ${fullName}`;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      name: projectName,
      stage: "opportunity_identified",
      project_type: projectType,
      message,
    })
    .select("id")
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }

  // Link contact to project
  await supabase.from("project_contacts").insert({
    project_id: project.id,
    contact_id: contact.id,
    role: "customer",
  });

  // Link company to project (if resolved)
  if (companyId) {
    await supabase.from("project_companies").insert({
      project_id: project.id,
      company_id: companyId,
      role: "customer",
    });
  }

  // Upload attachment if provided
  let attachmentUrl: string | null = null;
  if (file && file.size > 0) {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const path = `${project.id}/${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("project-attachments")
      .upload(path, buffer, { contentType: file.type });

    if (!uploadError) {
      const { data: urlData } = supabase.storage
        .from("project-attachments")
        .getPublicUrl(path);
      attachmentUrl = urlData.publicUrl;

      await supabase
        .from("projects")
        .update({ attachment_url: attachmentUrl })
        .eq("id", project.id);
    }
  }

  // Send email
  const attachmentLine = attachmentUrl ? `\nAttachment: ${attachmentUrl}` : "";
  await resend.emails.send({
    from: "Building NV <noreply@buildingnv.com>",
    to: "bids@buildingnv.com",
    subject: `New Project: ${fullName} — ${projectType ?? "General Inquiry"}`,
    text: [
      `Name: ${fullName}`,
      `Email: ${email}`,
      `Company: ${companyName || "—"}`,
      `Phone: ${phone}`,
      `Project Type: ${projectType ?? "—"}`,
      `Message: ${message ?? "—"}`,
      attachmentLine,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  return NextResponse.json({ success: true });
}
```

**Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/app/api/contact/route.ts
git commit -m "feat: update contact route to upsert contact/company and create project"
```

---

## Task 5: Update Contact Form

**Files:**
- Modify: `src/components/sections/Contact.tsx`

**Step 1: Add email field and update form to use FormData**

Replace the full file content:

```typescript
// src/components/sections/Contact.tsx
"use client";

import { useState } from "react";
import FadeUp from "@/components/FadeUp";

const projectTypes = [
  "Office Buildout",
  "Retail / Restaurant",
  "Warehouse / Industrial",
  "Suite Renovation",
  "Kitchen & Bathroom",
  "Other",
];

export default function Contact() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    projectType: "",
    message: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => formData.append(k, v));
      if (file) formData.append("attachment", file);

      const res = await fetch("/api/contact", { method: "POST", body: formData });
      if (res.ok) {
        setStatus("success");
        setForm({ name: "", email: "", company: "", phone: "", projectType: "", message: "" });
        setFile(null);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  const inputClass =
    "w-full bg-surface border border-border rounded-sm px-4 py-3 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent transition-colors";

  return (
    <section id="contact" className="py-32 px-6 bg-surface">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          <FadeUp>
            <div>
              <p className="text-accent text-sm font-semibold tracking-[0.2em] uppercase mb-4">
                Get In Touch
              </p>
              <h2 className="text-[clamp(36px,5vw,56px)] font-bold text-text-primary leading-tight mb-6">
                Let&apos;s Talk About Your Project
              </h2>
              <p className="text-text-muted leading-relaxed mb-10">
                Whether you have a space ready for buildout or are still in early planning, we want to hear about it. We respond within one business day.
              </p>
              <div className="flex flex-col gap-4">
                <a
                  href="tel:+17752000000"
                  className="flex items-center gap-3 text-text-primary hover:text-accent transition-colors"
                >
                  <span className="text-2xl font-bold">(775) 200-0000</span>
                </a>
                <p className="text-text-muted text-sm">Reno, Nevada</p>
              </div>
            </div>
          </FadeUp>

          <FadeUp delay={0.1}>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input name="name" type="text" placeholder="Your Name *" required
                  value={form.name} onChange={handleChange} className={inputClass} />
                <input name="company" type="text" placeholder="Company / Property"
                  value={form.company} onChange={handleChange} className={inputClass} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input name="email" type="email" placeholder="Email Address *" required
                  value={form.email} onChange={handleChange} className={inputClass} />
                <input name="phone" type="tel" placeholder="Phone Number *" required
                  value={form.phone} onChange={handleChange} className={inputClass} />
              </div>
              <select name="projectType" value={form.projectType} onChange={handleChange}
                className={`${inputClass} appearance-none`}>
                <option value="" disabled>Project Type</option>
                {projectTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <textarea name="message"
                placeholder="Tell us about your project — size, timeline, location..."
                rows={5} value={form.message} onChange={handleChange}
                className={`${inputClass} resize-none`} />
              <div>
                <label className="block text-text-muted text-xs uppercase tracking-widest mb-2">
                  Attach existing bid or plans (optional)
                </label>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="w-full text-text-muted text-sm file:mr-4 file:py-2 file:px-4 file:rounded-sm file:border-0 file:text-sm file:font-semibold file:bg-surface-2 file:text-text-primary hover:file:bg-border cursor-pointer" />
                {file && <p className="text-text-muted text-xs mt-1">{file.name}</p>}
              </div>
              <button type="submit" disabled={status === "loading"}
                className="w-full bg-accent text-bg font-semibold py-4 rounded-sm text-sm tracking-wide hover:bg-accent/90 transition-colors disabled:opacity-60">
                {status === "loading" ? "Sending..." : "Send Message"}
              </button>
              {status === "success" && (
                <p className="text-accent text-sm text-center">
                  Message sent. We&apos;ll be in touch soon.
                </p>
              )}
              {status === "error" && (
                <p className="text-red-400 text-sm text-center">
                  Something went wrong. Please call us directly.
                </p>
              )}
            </form>
          </FadeUp>
        </div>
      </div>
    </section>
  );
}
```

**Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/components/sections/Contact.tsx
git commit -m "feat: add email field and file attachment to contact form"
```

---

## Task 6: Admin Auth

**Files:**
- Create: `src/middleware.ts`
- Create: `src/app/admin/login/page.tsx`
- Create: `src/app/api/admin/login/route.ts`
- Create: `src/app/api/admin/logout/route.ts`

**Step 1: Create middleware**

```typescript
// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET ?? "fallback");

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/admin") || pathname === "/admin/login") {
    return NextResponse.next();
  }
  const token = req.cookies.get("admin_session")?.value;
  if (!token) return NextResponse.redirect(new URL("/admin/login", req.url));
  try {
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
}

export const config = { matcher: ["/admin/:path*"] };
```

**Step 2: Create login API route**

```typescript
// src/app/api/admin/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";

const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET ?? "fallback");

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }
  const token = await new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret);
  const res = NextResponse.json({ success: true });
  res.cookies.set("admin_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  return res;
}
```

**Step 3: Create logout API route**

```typescript
// src/app/api/admin/logout/route.ts
import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.delete("admin_session");
  return res;
}
```

**Step 4: Create login page**

```typescript
// src/app/admin/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.push("/admin");
    } else {
      setError("Invalid password");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-text-primary font-bold text-2xl mb-2">Building NV</h1>
        <p className="text-text-muted text-sm mb-8">Admin access</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input type="password" placeholder="Password" value={password}
            onChange={(e) => setPassword(e.target.value)} autoFocus
            className="w-full bg-surface border border-border rounded-sm px-4 py-3 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent transition-colors" />
          <button type="submit" disabled={loading}
            className="w-full bg-accent text-bg font-semibold py-3 rounded-sm text-sm hover:bg-accent/90 transition-colors disabled:opacity-60">
            {loading ? "Signing in..." : "Sign In"}
          </button>
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        </form>
      </div>
    </div>
  );
}
```

**Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add src/middleware.ts src/app/admin/login/page.tsx src/app/api/admin/login/route.ts src/app/api/admin/logout/route.ts
git commit -m "feat: add admin auth with signed cookie middleware"
```

---

## Task 7: Projects API Routes

**Files:**
- Create: `src/app/api/projects/route.ts`
- Create: `src/app/api/projects/[id]/route.ts`

**Step 1: Create GET /api/projects**

```typescript
// src/app/api/projects/route.ts
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("projects")
    .select(`
      *,
      project_contacts ( role, contact:contacts(*) ),
      project_companies ( role, company:companies(*) )
    `)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

**Step 2: Create PATCH /api/projects/[id]**

```typescript
// src/app/api/projects/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { stage, notes } = body;

  const update: Record<string, string> = {};
  if (stage !== undefined) update.stage = stage;
  if (notes !== undefined) update.notes = notes;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("projects")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

**Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/app/api/projects/route.ts src/app/api/projects/[id]/route.ts
git commit -m "feat: add projects API routes (GET with relations, PATCH)"
```

---

## Task 8: Admin Kanban Components

**Files:**
- Create: `src/components/admin/LeadCard.tsx`
- Create: `src/components/admin/KanbanColumn.tsx`

**Step 1: Create LeadCard**

```typescript
// src/components/admin/LeadCard.tsx
"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Project } from "@/lib/types";

interface LeadCardProps {
  project: Project;
  onClick: (project: Project) => void;
}

export default function LeadCard({ project, onClick }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: project.id,
    data: { project },
  });

  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.5 : 1 };

  const primaryContact = project.project_contacts?.[0]?.contact;
  const primaryCompany = project.project_companies?.[0]?.company;
  const date = new Date(project.created_at).toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });

  return (
    <div
      ref={setNodeRef} style={style} {...listeners} {...attributes}
      onClick={() => onClick(project)}
      className="bg-surface-2 border border-border rounded-sm p-3 cursor-grab active:cursor-grabbing hover:border-accent/40 transition-colors"
    >
      <p className="text-text-primary font-semibold text-sm leading-tight">{project.name}</p>
      {primaryCompany && (
        <p className="text-text-muted text-xs mt-0.5">{primaryCompany.name}</p>
      )}
      {primaryContact && (
        <p className="text-accent text-xs mt-1">{primaryContact.first_name} {primaryContact.last_name}</p>
      )}
      <div className="flex items-center justify-between mt-2">
        <p className="text-text-muted text-xs">{project.project_type ?? "—"}</p>
        <p className="text-text-muted text-xs">{date}</p>
      </div>
    </div>
  );
}
```

**Step 2: Create KanbanColumn**

```typescript
// src/components/admin/KanbanColumn.tsx
"use client";

import { useDroppable } from "@dnd-kit/core";
import { Project } from "@/lib/types";
import LeadCard from "./LeadCard";

interface KanbanColumnProps {
  id: string;
  label: string;
  projects: Project[];
  onCardClick: (project: Project) => void;
}

export default function KanbanColumn({ id, label, projects, onCardClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div className="flex flex-col min-w-[220px] w-[220px]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-text-muted text-xs font-semibold uppercase tracking-widest">{label}</h3>
        <span className="text-text-muted text-xs bg-surface-2 px-2 py-0.5 rounded-full">{projects.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex flex-col gap-2 flex-1 min-h-[80px] rounded-sm p-2 transition-colors ${isOver ? "bg-surface-2/60" : "bg-transparent"}`}
      >
        {projects.map((p) => <LeadCard key={p.id} project={p} onClick={onCardClick} />)}
      </div>
    </div>
  );
}
```

**Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/components/admin/LeadCard.tsx src/components/admin/KanbanColumn.tsx
git commit -m "feat: add kanban card and column components"
```

---

## Task 9: Lead Detail Panel

**Files:**
- Create: `src/components/admin/LeadPanel.tsx`

**Step 1: Create slide-out panel**

```typescript
// src/components/admin/LeadPanel.tsx
"use client";

import { useState } from "react";
import { Project, STAGES } from "@/lib/types";

interface LeadPanelProps {
  project: Project;
  onClose: () => void;
  onNotesUpdate: (id: string, notes: string) => void;
}

export default function LeadPanel({ project, onClose, onNotesUpdate }: LeadPanelProps) {
  const [notes, setNotes] = useState(project.notes ?? "");
  const [saving, setSaving] = useState(false);
  const stageLabel = STAGES.find((s) => s.id === project.stage)?.label ?? project.stage;
  const date = new Date(project.created_at).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  const saveNotes = async () => {
    setSaving(true);
    await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    onNotesUpdate(project.id, notes);
    setSaving(false);
  };

  return (
    <>
      <div className="fixed inset-0 bg-bg/60 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-surface border-l border-border z-50 overflow-y-auto">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-text-primary font-bold text-xl leading-tight">{project.name}</h2>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary text-2xl leading-none ml-4">×</button>
          </div>

          <span className="inline-block text-accent text-xs font-semibold tracking-widest uppercase border border-accent/30 px-3 py-1 rounded-full mb-6">
            {stageLabel}
          </span>

          {/* Contacts */}
          {project.project_contacts?.length > 0 && (
            <div className="mb-4">
              <p className="text-text-muted text-xs uppercase tracking-widest mb-2">Contacts</p>
              {project.project_contacts.map(({ contact, role }) => (
                <div key={contact.id} className="mb-2">
                  <p className="text-text-primary text-sm font-semibold">
                    {contact.first_name} {contact.last_name}
                    <span className="text-text-muted font-normal ml-2 text-xs">({role})</span>
                  </p>
                  {contact.email && (
                    <a href={`mailto:${contact.email}`} className="text-accent text-xs hover:underline">{contact.email}</a>
                  )}
                  {contact.phone && <p className="text-text-muted text-xs">{contact.phone}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Companies */}
          {project.project_companies?.length > 0 && (
            <div className="mb-4">
              <p className="text-text-muted text-xs uppercase tracking-widest mb-2">Companies</p>
              {project.project_companies.map(({ company, role }) => (
                <div key={company.id} className="mb-1">
                  <p className="text-text-primary text-sm">
                    {company.name}
                    <span className="text-text-muted ml-2 text-xs">({role})</span>
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3 mb-6">
            {project.project_type && <Field label="Project Type" value={project.project_type} />}
            <Field label="Submitted" value={date} />
            {project.message && <Field label="Message" value={project.message} multiline />}
            {project.attachment_url && (
              <div>
                <p className="text-text-muted text-xs uppercase tracking-widest mb-1">Attachment</p>
                <a href={project.attachment_url} target="_blank" rel="noopener noreferrer"
                  className="text-accent text-sm hover:underline">View / Download</a>
              </div>
            )}
          </div>

          <div>
            <p className="text-text-muted text-xs uppercase tracking-widest mb-2">Internal Notes</p>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveNotes}
              rows={5} placeholder="Add notes..."
              className="w-full bg-surface-2 border border-border rounded-sm px-4 py-3 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent transition-colors resize-none" />
            {saving && <p className="text-text-muted text-xs mt-1">Saving...</p>}
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <p className="text-text-muted text-xs uppercase tracking-widest mb-1">{label}</p>
      {multiline
        ? <p className="text-text-primary text-sm leading-relaxed whitespace-pre-wrap">{value}</p>
        : <p className="text-text-primary text-sm">{value}</p>}
    </div>
  );
}
```

**Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/components/admin/LeadPanel.tsx
git commit -m "feat: add lead detail panel with contacts, companies, and notes"
```

---

## Task 10: KanbanBoard and Admin Page

**Files:**
- Create: `src/components/admin/KanbanBoard.tsx`
- Create: `src/app/admin/page.tsx`

**Step 1: Create KanbanBoard**

```typescript
// src/components/admin/KanbanBoard.tsx
"use client";

import { useState } from "react";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Project, STAGES, StageId } from "@/lib/types";
import KanbanColumn from "./KanbanColumn";
import LeadPanel from "./LeadPanel";

export default function KanbanBoard({ initialProjects }: { initialProjects: Project[] }) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [selected, setSelected] = useState<Project | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const openCount = projects.filter(
    (p) => p.stage !== "contract_signed" && p.stage !== "closed_lost"
  ).length;

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const projectId = active.id as string;
    const newStage = over.id as StageId;
    setProjects((prev) => prev.map((p) => p.id === projectId ? { ...p, stage: newStage } : p));
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: newStage }),
    });
  };

  const handleNotesUpdate = (id: string, notes: string) => {
    setProjects((prev) => prev.map((p) => p.id === id ? { ...p, notes } : p));
    setSelected((prev) => prev?.id === id ? { ...prev, notes } : prev);
  };

  return (
    <div className="min-h-screen bg-bg">
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div>
          <span className="text-text-primary font-bold text-lg">Building NV</span>
          <span className="text-text-muted text-sm ml-3">Bid Pipeline</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-text-muted text-sm">
            <span className="text-accent font-semibold">{openCount}</span> open bids
          </span>
          <form action="/api/admin/logout" method="POST">
            <button type="submit" className="text-text-muted text-xs hover:text-text-primary transition-colors">
              Sign out
            </button>
          </form>
        </div>
      </div>
      <div className="overflow-x-auto p-6">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 w-max">
            {STAGES.map((stage) => (
              <KanbanColumn
                key={stage.id}
                id={stage.id}
                label={stage.label}
                projects={projects.filter((p) => p.stage === stage.id)}
                onCardClick={setSelected}
              />
            ))}
          </div>
        </DndContext>
      </div>
      {selected && (
        <LeadPanel
          project={selected}
          onClose={() => setSelected(null)}
          onNotesUpdate={handleNotesUpdate}
        />
      )}
    </div>
  );
}
```

**Step 2: Create admin page server component**

```typescript
// src/app/admin/page.tsx
import { createServiceClient } from "@/lib/supabase";
import KanbanBoard from "@/components/admin/KanbanBoard";
import { Project } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("projects")
    .select(`*, project_contacts(role, contact:contacts(*)), project_companies(role, company:companies(*))`)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-red-400">Failed to load projects: {error.message}</p>
      </div>
    );
  }

  return <KanbanBoard initialProjects={(data ?? []) as Project[]} />;
}
```

**Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

**Step 4: Production build**

```bash
npm run build
```

Expected: no errors. Routes should include `/admin`, `/admin/login`, `/api/projects`, `/api/projects/[id]`, `/api/contact`.

**Step 5: Commit**

```bash
git add src/components/admin/KanbanBoard.tsx src/app/admin/page.tsx
git commit -m "feat: wire up kanban board and admin page"
```

---

## Task 11: Seed Database

If you have existing projects to import, use the Supabase SQL editor. Example:

```sql
-- Insert a company
INSERT INTO companies (name, type, domain) VALUES ('Acme Corp', 'customer', 'acmecorp.com');

-- Insert a contact
INSERT INTO contacts (first_name, last_name, email, phone, type, primary_company_id)
VALUES ('Jane', 'Smith', 'jane@acmecorp.com', '775-555-0101', 'customer',
  (SELECT id FROM companies WHERE domain = 'acmecorp.com'));

-- Insert a project
INSERT INTO projects (name, stage, project_type, notes)
VALUES ('Office Buildout — Acme Corp', 'bid_delivered', 'Office Buildout', 'Waiting on owner approval');

-- Link them
INSERT INTO project_contacts (project_id, contact_id, role)
VALUES (
  (SELECT id FROM projects WHERE name = 'Office Buildout — Acme Corp'),
  (SELECT id FROM contacts WHERE email = 'jane@acmecorp.com'),
  'customer'
);

INSERT INTO project_companies (project_id, company_id, role)
VALUES (
  (SELECT id FROM projects WHERE name = 'Office Buildout — Acme Corp'),
  (SELECT id FROM companies WHERE domain = 'acmecorp.com'),
  'customer'
);
```

---

## Quick Reference

| URL | Purpose |
|---|---|
| `http://localhost:3000` | Marketing site |
| `http://localhost:3000/admin` | Kanban CRM |
| `http://localhost:3000/admin/login` | Admin login |

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
ADMIN_PASSWORD=
ADMIN_JWT_SECRET=
```
