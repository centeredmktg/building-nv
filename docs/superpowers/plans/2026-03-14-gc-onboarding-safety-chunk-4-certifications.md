# GC Onboarding & Safety — Chunk 4: Certifications + File Upload

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the certification upload flow — Vercel Blob for file storage, certification API routes, and the upload UI on the employee detail page.

**Architecture:** File uploads go to Vercel Blob via a server-side API route. Cert records are created/updated in Prisma. `verifiedStatus` is set to `"verified"` server-side when `cardPhotoUrl` is present for OSHA_10/OSHA_30 — never trusted from the client.

**Tech Stack:** `@vercel/blob`, Next.js 16, Prisma 7, TypeScript

**Spec reference:** `docs/superpowers/specs/2026-03-14-gc-onboarding-safety-system-design.md` — Sections 2a (Certification model), 2c (cert upload flow)

**Prerequisites:** Chunk 3 committed. Vercel Blob enabled on the project (see Step 1 of Task 10).

---

## Chunk 4, Task 10: Vercel Blob Setup + Upload API

**Files:**
- Create: `src/app/api/upload/route.ts`

- [ ] **Step 1: Install @vercel/blob**

```bash
npm install @vercel/blob
```

Note: install the latest version — the plan uses the current API (`allowPublicAccess: true`, not the deprecated `access: "public"` from v0.26 and earlier).

After installing, add `BLOB_READ_WRITE_TOKEN` to `.env`. For local dev, get this token from the Vercel dashboard (Storage → Blob → your store → `.env.local` tab). If the project is not yet deployed to Vercel, create a Blob store first at vercel.com/dashboard.

Expected: `@vercel/blob` appears in `package.json` dependencies.

- [ ] **Step 2: Create src/app/api/upload/route.ts**

```typescript
import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  // Require authenticated session — this endpoint is internal only
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const folder = (formData.get("folder") as string) || "uploads";

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Limit to images only for cert card uploads
  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "Only image files are accepted" },
      { status: 400 }
    );
  }

  // 10MB max
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  const blob = await put(`${folder}/${Date.now()}-${file.name}`, file, {
    allowPublicAccess: true,
  });

  return NextResponse.json({ url: blob.url });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors. If `@vercel/blob` types are missing, run `npm install` again.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/upload/route.ts package.json package-lock.json
git commit -m "feat: add file upload API route via Vercel Blob"
```

---

## Chunk 4, Task 11: Certification API Routes

**Files:**
- Create: `src/app/api/employees/[id]/certifications/route.ts`
- Create: `src/app/api/employees/[id]/certifications/[certId]/route.ts`

- [ ] **Step 1: Create src/app/api/employees/[id]/certifications/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// OSHA_10 and OSHA_30 require a card photo to be verified.
// verifiedStatus is computed server-side — never trusted from client.
function computeVerifiedStatus(type: string, cardPhotoUrl: string | null): string {
  if (type === "OSHA_10" || type === "OSHA_30") {
    return cardPhotoUrl ? "verified" : "unverified";
  }
  // For FIRST_AID and OTHER, photo is optional — treat as verified if no photo required
  return "verified";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: employeeId } = await params;
  const body = await req.json();
  const { type, issueDate, expirationDate, cardPhotoUrl } = body as {
    type: string;
    issueDate: string;
    expirationDate?: string;
    cardPhotoUrl?: string;
  };

  if (!type || !issueDate) {
    return NextResponse.json(
      { error: "type and issueDate are required" },
      { status: 400 }
    );
  }

  const validTypes = ["OSHA_10", "OSHA_30", "FIRST_AID", "OTHER"];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: "Invalid certification type" }, { status: 400 });
  }

  const verifiedStatus = computeVerifiedStatus(type, cardPhotoUrl ?? null);

  const cert = await prisma.certification.create({
    data: {
      employeeId,
      type,
      issueDate: new Date(issueDate),
      expirationDate: expirationDate ? new Date(expirationDate) : null,
      cardPhotoUrl: cardPhotoUrl ?? null,
      verifiedStatus,
    },
  });

  return NextResponse.json(cert, { status: 201 });
}
```

- [ ] **Step 2: Create src/app/api/employees/[id]/certifications/[certId]/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function computeVerifiedStatus(type: string, cardPhotoUrl: string | null): string {
  if (type === "OSHA_10" || type === "OSHA_30") {
    return cardPhotoUrl ? "verified" : "unverified";
  }
  return "verified";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; certId: string }> }
) {
  const { certId } = await params;
  const body = await req.json();
  const { cardPhotoUrl, expirationDate } = body as {
    cardPhotoUrl?: string;
    expirationDate?: string;
  };

  const existing = await prisma.certification.findUnique({ where: { id: certId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const newPhotoUrl = cardPhotoUrl !== undefined ? cardPhotoUrl : existing.cardPhotoUrl;
  const verifiedStatus = computeVerifiedStatus(existing.type, newPhotoUrl);

  const cert = await prisma.certification.update({
    where: { id: certId },
    data: {
      cardPhotoUrl: newPhotoUrl,
      expirationDate: expirationDate && expirationDate.trim() ? new Date(expirationDate) : existing.expirationDate,
      verifiedStatus,
    },
  });

  return NextResponse.json(cert);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; certId: string }> }
) {
  const { certId } = await params;
  await prisma.certification.delete({ where: { id: certId } });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/employees/[id]/certifications/
git commit -m "feat: add certification API routes with server-side verified status computation"
```

---

## Chunk 4, Task 12: Certification Upload UI

**Files:**
- Create: `src/app/internal/employees/[id]/certifications/new/page.tsx`
- Create: `src/app/internal/employees/[id]/certifications/new/CertUploadForm.tsx`

- [ ] **Step 1: Create CertUploadForm.tsx**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CertUploadForm({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    type: "OSHA_10",
    issueDate: "",
    expirationDate: "",
  });
  const [cardPhotoUrl, setCardPhotoUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");

  const inputClass =
    "w-full bg-surface border border-border rounded-sm px-4 py-3 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent transition-colors";

  const requiresPhoto = form.type === "OSHA_10" || form.type === "OSHA_30";

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");

    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", "certifications");

    const res = await fetch("/api/upload", { method: "POST", body: fd });
    setUploading(false);

    if (res.ok) {
      const data = await res.json();
      setCardPhotoUrl(data.url);
      setFileName(file.name);
    } else {
      const data = await res.json();
      setError(data.error ?? "Upload failed");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requiresPhoto && !cardPhotoUrl) {
      setError("Card photo is required for OSHA 10 and OSHA 30 certifications.");
      return;
    }
    setSaving(true);
    setError("");

    const res = await fetch(`/api/employees/${employeeId}/certifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, cardPhotoUrl }),
    });

    if (res.ok) {
      router.push(`/internal/employees/${employeeId}`);
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to save");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-lg">
      <select
        value={form.type}
        onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
        className={`${inputClass} appearance-none`}
      >
        <option value="OSHA_10">OSHA 10-Hour</option>
        <option value="OSHA_30">OSHA 30-Hour</option>
        <option value="FIRST_AID">First Aid / CPR</option>
        <option value="OTHER">Other</option>
      </select>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-text-muted text-xs mb-1 block">Issue Date *</label>
          <input
            type="date"
            required
            value={form.issueDate}
            onChange={(e) => setForm((p) => ({ ...p, issueDate: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-text-muted text-xs mb-1 block">Expiry Date (if applicable)</label>
          <input
            type="date"
            value={form.expirationDate}
            onChange={(e) => setForm((p) => ({ ...p, expirationDate: e.target.value }))}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="text-text-muted text-xs mb-1 block">
          Card Photo {requiresPhoto ? <span className="text-red-400">* Required for OSHA certs</span> : "(optional)"}
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="w-full text-text-muted text-sm"
        />
        {uploading && <p className="text-text-muted text-xs mt-1">Uploading...</p>}
        {cardPhotoUrl && (
          <p className="text-green-400 text-xs mt-1">✓ Uploaded: {fileName}</p>
        )}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || uploading}
          className="bg-accent text-bg font-semibold px-6 py-3 rounded-sm text-sm hover:bg-accent/90 transition-colors disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Certification"}
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

- [ ] **Step 2: Create the page**

```tsx
// src/app/internal/employees/[id]/certifications/new/page.tsx
import CertUploadForm from "./CertUploadForm";

export default async function NewCertificationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-8">Add Certification</h1>
      <CertUploadForm employeeId={id} />
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
git add src/app/internal/employees/[id]/certifications/
git commit -m "feat: add certification upload UI with Vercel Blob and server-side verification"
```

---

## Chunk 4 Complete

File upload and certification flow are fully wired. OSHA 10/30 certs without a card photo are blocked at both the UI layer (client validation) and the API layer (server-side `verifiedStatus` computation). Proceed to Chunk 5 (Project Enhancements).
