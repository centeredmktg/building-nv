# Lead CRM Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add lead persistence (Supabase Postgres), email notification (Resend), file attachments (Supabase Storage), and a kanban admin CRM at `/admin` to the Building NV marketing site.

**Architecture:** The contact form submits multipart/form-data to `/api/contact`, which uploads any attachment to Supabase Storage, saves the lead to Postgres, and sends a notification email via Resend. The `/admin` section is protected by signed-cookie middleware (jose) and shows a drag-and-drop kanban board (dnd-kit) across 7 pipeline stages.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + Storage), Resend, dnd-kit/core + dnd-kit/utilities, jose.

---

## Prerequisites (manual steps before running tasks)

1. Create a Supabase project at https://supabase.com — free tier is sufficient
2. In Supabase SQL editor, run the schema in Task 1
3. In Supabase Storage, create a public bucket named `lead-attachments`
4. Create a Resend account at https://resend.com, get an API key, verify your sending domain
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

**Step 1: Run schema SQL in Supabase SQL editor**

```sql
CREATE TABLE leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company text,
  phone text NOT NULL,
  project_type text,
  message text,
  stage text NOT NULL DEFAULT 'opportunity_identified',
  notes text,
  attachment_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
```

**Step 2: Verify**

In Supabase Table Editor, confirm the `leads` table exists with all columns.

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

## Task 3: Supabase Client Utilities

**Files:**
- Create: `src/lib/supabase.ts`

**Step 1: Create Supabase utility module**

```typescript
// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

// Browser client — uses anon key, safe to expose
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Server client — uses service role key, never sent to browser
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

**Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no output.

**Step 3: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "feat: add Supabase client utilities"
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
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const formData = await req.formData();

  const name = formData.get("name") as string | null;
  const company = formData.get("company") as string | null;
  const phone = formData.get("phone") as string | null;
  const projectType = formData.get("projectType") as string | null;
  const message = formData.get("message") as string | null;
  const file = formData.get("attachment") as File | null;

  if (!name || !phone) {
    return NextResponse.json({ error: "Name and phone are required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Insert lead first to get the ID
  const { data: lead, error: insertError } = await supabase
    .from("leads")
    .insert({
      name,
      company: company || null,
      phone,
      project_type: projectType || null,
      message: message || null,
    })
    .select()
    .single();

  if (insertError || !lead) {
    console.error("Failed to insert lead:", insertError);
    return NextResponse.json({ error: "Failed to save lead" }, { status: 500 });
  }

  // Upload attachment if provided
  let attachmentUrl: string | null = null;
  if (file && file.size > 0) {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const path = `${lead.id}/${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("lead-attachments")
      .upload(path, buffer, { contentType: file.type });

    if (!uploadError) {
      const { data: urlData } = supabase.storage
        .from("lead-attachments")
        .getPublicUrl(path);
      attachmentUrl = urlData.publicUrl;

      await supabase
        .from("leads")
        .update({ attachment_url: attachmentUrl })
        .eq("id", lead.id);
    } else {
      console.error("Attachment upload failed:", uploadError);
    }
  }

  // Send email notification
  const attachmentLine = attachmentUrl
    ? `\nAttachment: ${attachmentUrl}`
    : "";

  await resend.emails.send({
    from: "Building NV <noreply@buildingnv.com>",
    to: "bids@buildingnv.com",
    subject: `New Lead: ${name} — ${projectType || "General Inquiry"}`,
    text: [
      `Name: ${name}`,
      `Company: ${company || "—"}`,
      `Phone: ${phone}`,
      `Project Type: ${projectType || "—"}`,
      `Message: ${message || "—"}`,
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

Expected: no output.

**Step 3: Commit**

```bash
git add src/app/api/contact/route.ts
git commit -m "feat: connect contact form to Supabase and Resend"
```

---

## Task 5: Update Contact Form for File Upload

**Files:**
- Modify: `src/components/sections/Contact.tsx`

**Step 1: Update handleSubmit to use FormData**

Replace the `handleSubmit` function and add file state. Here is the complete updated file:

```typescript
// src/components/sections/Contact.tsx
"use client";

import { useState } from "react";
import FadeUp from "@/components/FadeUp";

const projectTypes = [
  "Office Buildout",
  "Retail / Restaurant",
  "Medical Suite",
  "Warehouse / Industrial",
  "Suite Renovation",
  "Other",
];

export default function Contact() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    name: "",
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
      formData.append("name", form.name);
      formData.append("company", form.company);
      formData.append("phone", form.phone);
      formData.append("projectType", form.projectType);
      formData.append("message", form.message);
      if (file) formData.append("attachment", file);

      const res = await fetch("/api/contact", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setStatus("success");
        setForm({ name: "", company: "", phone: "", projectType: "", message: "" });
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
                <input
                  name="name"
                  type="text"
                  placeholder="Your Name *"
                  required
                  value={form.name}
                  onChange={handleChange}
                  className={inputClass}
                />
                <input
                  name="company"
                  type="text"
                  placeholder="Company / Property"
                  value={form.company}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <input
                name="phone"
                type="tel"
                placeholder="Phone Number *"
                required
                value={form.phone}
                onChange={handleChange}
                className={inputClass}
              />
              <select
                name="projectType"
                value={form.projectType}
                onChange={handleChange}
                className={`${inputClass} appearance-none`}
              >
                <option value="" disabled>
                  Project Type
                </option>
                {projectTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <textarea
                name="message"
                placeholder="Tell us about your project — size, timeline, location..."
                rows={5}
                value={form.message}
                onChange={handleChange}
                className={`${inputClass} resize-none`}
              />

              {/* File attachment */}
              <div>
                <label className="block text-text-muted text-xs uppercase tracking-widest mb-2">
                  Attach existing bid or plans (optional)
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="w-full text-text-muted text-sm file:mr-4 file:py-2 file:px-4 file:rounded-sm file:border-0 file:text-sm file:font-semibold file:bg-surface-2 file:text-text-primary hover:file:bg-border cursor-pointer"
                />
                {file && (
                  <p className="text-text-muted text-xs mt-1">{file.name}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full bg-accent text-bg font-semibold py-4 rounded-sm text-sm tracking-wide hover:bg-accent/90 transition-colors disabled:opacity-60"
              >
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
git commit -m "feat: add file attachment to contact form"
```

---

## Task 6: Admin Auth (Middleware + Login)

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

  if (!token) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  try {
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
}

export const config = {
  matcher: ["/admin/:path*"],
};
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
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            className="w-full bg-surface border border-border rounded-sm px-4 py-3 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent transition-colors"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-bg font-semibold py-3 rounded-sm text-sm hover:bg-accent/90 transition-colors disabled:opacity-60"
          >
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

## Task 7: Leads API Routes

**Files:**
- Create: `src/app/api/leads/route.ts`
- Create: `src/app/api/leads/[id]/route.ts`

**Step 1: Create GET /api/leads**

```typescript
// src/app/api/leads/route.ts
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
```

**Step 2: Create PATCH /api/leads/[id]**

```typescript
// src/app/api/leads/[id]/route.ts
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
    .from("leads")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
```

**Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/app/api/leads/route.ts src/app/api/leads/[id]/route.ts
git commit -m "feat: add leads API routes (GET all, PATCH stage/notes)"
```

---

## Task 8: Lead Types

**Files:**
- Create: `src/lib/types.ts`

**Step 1: Create shared types**

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

export interface Lead {
  id: string;
  name: string;
  company: string | null;
  phone: string;
  project_type: string | null;
  message: string | null;
  stage: StageId;
  notes: string | null;
  attachment_url: string | null;
  created_at: string;
  updated_at: string;
}
```

**Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add shared Lead types and STAGES constant"
```

---

## Task 9: Admin Kanban Board

**Files:**
- Create: `src/app/admin/page.tsx`
- Create: `src/components/admin/KanbanBoard.tsx`
- Create: `src/components/admin/KanbanColumn.tsx`
- Create: `src/components/admin/LeadCard.tsx`

**Step 1: Create LeadCard component**

```typescript
// src/components/admin/LeadCard.tsx
"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Lead } from "@/lib/types";

interface LeadCardProps {
  lead: Lead;
  onClick: (lead: Lead) => void;
}

export default function LeadCard({ lead, onClick }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const date = new Date(lead.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onClick(lead)}
      className="bg-surface-2 border border-border rounded-sm p-3 cursor-grab active:cursor-grabbing hover:border-accent/40 transition-colors"
    >
      <p className="text-text-primary font-semibold text-sm">{lead.name}</p>
      {lead.company && (
        <p className="text-text-muted text-xs mt-0.5">{lead.company}</p>
      )}
      <p className="text-accent text-xs mt-1">{lead.project_type ?? "—"}</p>
      <div className="flex items-center justify-between mt-2">
        <p className="text-text-muted text-xs">{lead.phone}</p>
        <p className="text-text-muted text-xs">{date}</p>
      </div>
    </div>
  );
}
```

**Step 2: Create KanbanColumn component**

```typescript
// src/components/admin/KanbanColumn.tsx
"use client";

import { useDroppable } from "@dnd-kit/core";
import { Lead } from "@/lib/types";
import LeadCard from "./LeadCard";

interface KanbanColumnProps {
  id: string;
  label: string;
  leads: Lead[];
  onCardClick: (lead: Lead) => void;
}

export default function KanbanColumn({ id, label, leads, onCardClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="flex flex-col min-w-[220px] w-[220px]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-text-muted text-xs font-semibold uppercase tracking-widest">
          {label}
        </h3>
        <span className="text-text-muted text-xs bg-surface-2 px-2 py-0.5 rounded-full">
          {leads.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex flex-col gap-2 flex-1 min-h-[80px] rounded-sm p-2 transition-colors ${
          isOver ? "bg-surface-2/60" : "bg-transparent"
        }`}
      >
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} onClick={onCardClick} />
        ))}
      </div>
    </div>
  );
}
```

**Step 3: Create KanbanBoard component**

```typescript
// src/components/admin/KanbanBoard.tsx
"use client";

import { useState } from "react";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Lead, STAGES, StageId } from "@/lib/types";
import KanbanColumn from "./KanbanColumn";
import LeadPanel from "./LeadPanel";

interface KanbanBoardProps {
  initialLeads: Lead[];
}

export default function KanbanBoard({ initialLeads }: KanbanBoardProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  }));

  const openCount = leads.filter(
    (l) => l.stage !== "contract_signed" && l.stage !== "closed_lost"
  ).length;

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const leadId = active.id as string;
    const newStage = over.id as StageId;

    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, stage: newStage } : l))
    );

    await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: newStage }),
    });
  };

  const handleNotesUpdate = (id: string, notes: string) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, notes } : l)));
    if (selectedLead?.id === id) {
      setSelectedLead((prev) => prev ? { ...prev, notes } : prev);
    }
  };

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
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
            <button
              type="submit"
              className="text-text-muted text-xs hover:text-text-primary transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>

      {/* Board */}
      <div className="overflow-x-auto p-6">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 w-max">
            {STAGES.map((stage) => (
              <KanbanColumn
                key={stage.id}
                id={stage.id}
                label={stage.label}
                leads={leads.filter((l) => l.stage === stage.id)}
                onCardClick={setSelectedLead}
              />
            ))}
          </div>
        </DndContext>
      </div>

      {/* Detail panel */}
      {selectedLead && (
        <LeadPanel
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onNotesUpdate={handleNotesUpdate}
        />
      )}
    </div>
  );
}
```

**Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/components/admin/
git commit -m "feat: add kanban board components (LeadCard, KanbanColumn, KanbanBoard)"
```

---

## Task 10: Lead Detail Panel

**Files:**
- Create: `src/components/admin/LeadPanel.tsx`

**Step 1: Create slide-out panel**

```typescript
// src/components/admin/LeadPanel.tsx
"use client";

import { useState } from "react";
import { Lead, STAGES } from "@/lib/types";

interface LeadPanelProps {
  lead: Lead;
  onClose: () => void;
  onNotesUpdate: (id: string, notes: string) => void;
}

export default function LeadPanel({ lead, onClose, onNotesUpdate }: LeadPanelProps) {
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [saving, setSaving] = useState(false);

  const stageLabel = STAGES.find((s) => s.id === lead.stage)?.label ?? lead.stage;

  const saveNotes = async () => {
    setSaving(true);
    await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    onNotesUpdate(lead.id, notes);
    setSaving(false);
  };

  const date = new Date(lead.created_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-bg/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-surface border-l border-border z-50 overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-text-primary font-bold text-xl">{lead.name}</h2>
              {lead.company && (
                <p className="text-text-muted text-sm mt-0.5">{lead.company}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-text-muted hover:text-text-primary transition-colors text-xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Stage badge */}
          <span className="inline-block text-accent text-xs font-semibold tracking-widest uppercase border border-accent/30 px-3 py-1 rounded-full mb-6">
            {stageLabel}
          </span>

          {/* Fields */}
          <div className="flex flex-col gap-4 mb-6">
            <Field label="Phone" value={lead.phone} href={`tel:${lead.phone}`} />
            <Field label="Project Type" value={lead.project_type ?? "—"} />
            <Field label="Submitted" value={date} />
            {lead.message && <Field label="Message" value={lead.message} multiline />}
            {lead.attachment_url && (
              <div>
                <p className="text-text-muted text-xs uppercase tracking-widest mb-1">Attachment</p>
                <a
                  href={lead.attachment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent text-sm hover:underline"
                >
                  View / Download
                </a>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <p className="text-text-muted text-xs uppercase tracking-widest mb-2">
              Internal Notes
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveNotes}
              rows={5}
              placeholder="Add notes..."
              className="w-full bg-surface-2 border border-border rounded-sm px-4 py-3 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent transition-colors resize-none"
            />
            {saving && (
              <p className="text-text-muted text-xs mt-1">Saving...</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  value,
  href,
  multiline,
}: {
  label: string;
  value: string;
  href?: string;
  multiline?: boolean;
}) {
  return (
    <div>
      <p className="text-text-muted text-xs uppercase tracking-widest mb-1">{label}</p>
      {href ? (
        <a href={href} className="text-text-primary text-sm hover:text-accent transition-colors">
          {value}
        </a>
      ) : multiline ? (
        <p className="text-text-primary text-sm leading-relaxed whitespace-pre-wrap">{value}</p>
      ) : (
        <p className="text-text-primary text-sm">{value}</p>
      )}
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
git commit -m "feat: add lead detail panel with notes editing"
```

---

## Task 11: Admin Page (Server Component)

**Files:**
- Create: `src/app/admin/page.tsx`

**Step 1: Create server component that fetches leads and renders the board**

```typescript
// src/app/admin/page.tsx
import { createServiceClient } from "@/lib/supabase";
import KanbanBoard from "@/components/admin/KanbanBoard";
import { Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-red-400">Failed to load leads: {error.message}</p>
      </div>
    );
  }

  return <KanbanBoard initialLeads={(data ?? []) as Lead[]} />;
}
```

**Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

**Step 3: Run production build**

```bash
npm run build
```

Expected: no errors. Routes should include `/admin`, `/admin/login`, `/api/leads`, `/api/leads/[id]`.

**Step 4: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: add admin page server component wiring leads into kanban board"
```

---

## Task 12: Seed Database (Optional)

If you have existing leads to import, insert them directly in the Supabase SQL editor:

```sql
INSERT INTO leads (name, company, phone, project_type, stage, notes) VALUES
  ('Jane Smith', 'Acme Corp', '775-555-0101', 'Office Buildout', 'bid_delivered', 'Waiting on owner approval'),
  ('Bob Jones', 'NV Properties', '775-555-0102', 'Suite Renovation', 'quote_requested', NULL);
```

Or use the Supabase Table Editor to insert rows manually.

---

## Quick Reference

| URL | Purpose |
|---|---|
| `http://localhost:3000` | Marketing site |
| `http://localhost:3000/admin` | Kanban CRM (redirects to login if not authenticated) |
| `http://localhost:3000/admin/login` | Admin login |

## Environment Variables Needed

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
ADMIN_PASSWORD=
ADMIN_JWT_SECRET=
```
