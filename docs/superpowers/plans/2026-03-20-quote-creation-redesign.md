# Quote Creation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the multi-step wizard quote creation flow with a single-page, streaming-first intake that accepts unstructured text (typed scope, pasted RFP, voice transcript), evaluates completeness in real time, renders a live draft inline, and surfaces gap callouts — while unifying the Client data model with the CRM's Contact/Company records.

**Architecture:** Schema migration adds `QuoteContact`/`QuoteCompany` junction tables and makes `Quote.clientId` + `Contact.email` nullable. The generate endpoint switches to NDJSON streaming so sections render progressively. The new quote page is a single surface: type-ahead contact/company search, inline create, streaming draft, gap callouts, and a manual mode bypass.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma + SQLite, Tailwind CSS, Anthropic SDK (streaming), Jest

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `QuoteContact`, `QuoteCompany`; nullable `clientId`/`email`; back-relations |
| `prisma/migrations/` | Generate | Migration created by `prisma migrate dev` |
| `src/generated/prisma/` | Regenerated | Stage after migration |
| `src/lib/claude.ts` | Modify | New types + streaming `generateQuoteStream` function |
| `src/app/api/quotes/generate/route.ts` | Modify | Streaming NDJSON response |
| `src/app/api/quotes/route.ts` | Modify | Rewrite POST: accept contacts/companies, no Client creation |
| `src/app/api/contacts/route.ts` | Create | GET (search) + POST (create) internal contacts |
| `src/app/api/companies/route.ts` | Create | GET (search) + POST (create) internal companies |
| `src/app/internal/quotes/new/page.tsx` | Rewrite | Full new quote intake page |
| `src/__tests__/quoteGenerate.test.ts` | Modify | Update for new response shape |

---

## Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Run: `npx prisma migrate dev`

- [ ] **Step 1: Add `QuoteContact` and `QuoteCompany` models + back-relations**

In `prisma/schema.prisma`, after the `ProjectCompany` model, add:

```prisma
model QuoteContact {
  id        String  @id @default(cuid())
  quoteId   String
  quote     Quote   @relation(fields: [quoteId], references: [id], onDelete: Cascade)
  contactId String
  contact   Contact @relation(fields: [contactId], references: [id], onDelete: Cascade)
  role      String  @default("decision_maker") // decision_maker | site_contact | billing_contact
}

model QuoteCompany {
  id        String  @id @default(cuid())
  quoteId   String
  quote     Quote   @relation(fields: [quoteId], references: [id], onDelete: Cascade)
  companyId String
  company   Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
  role      String  @default("tenant") // tenant | landlord | property_manager | owner
}
```

- [ ] **Step 2: Make `Quote.clientId` nullable + add back-relations to Quote**

In the `Quote` model, change:
```prisma
clientId          String
client            Client          @relation(fields: [clientId], references: [id])
```
to:
```prisma
clientId          String?
client            Client?         @relation(fields: [clientId], references: [id])
quoteContacts     QuoteContact[]
quoteCompanies    QuoteCompany[]
```

- [ ] **Step 3: Make `Contact.email` nullable + add back-relation**

In the `Contact` model, change:
```prisma
email            String           @unique
```
to:
```prisma
email            String?          @unique
```

Also add to `Contact`:
```prisma
quoteContacts    QuoteContact[]
```

- [ ] **Step 4: Add back-relation to `Company`**

In the `Company` model, add:
```prisma
quoteCompanies   QuoteCompany[]
```

- [ ] **Step 5: Run migration**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/building-nv
npx prisma migrate dev --name add-quote-contacts-nullable-email
```

Expected: migration file created, `src/generated/prisma` regenerated.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: zero errors. If errors appear on `contact.email` comparisons (now nullable), fix them before proceeding — search for `contact.email` usages that assume non-null.

- [ ] **Step 7: Stage generated files and commit**

```bash
git add prisma/schema.prisma prisma/migrations/ src/generated/
git commit -m "feat: add QuoteContact/QuoteCompany, nullable clientId and Contact.email"
```

> ⚠ **Deployment coupling:** The spec flags `POST /api/quotes` as a **coupled change** — once `clientId` is nullable in the schema, the existing handler must also be updated or new quote creation breaks. Task 6 rewrites this handler. Tasks 1 and 6 must be deployed together as a single release. Do not merge Task 1 to production without Task 6 also complete.

---

## Task 2: Internal Contacts API (GET search + POST create)

**Files:**
- Create: `src/app/api/contacts/route.ts`
- Create: `src/__tests__/contacts.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/__tests__/contacts.test.ts

// Mocks MUST come before the import that triggers module loading
jest.mock('@/lib/prisma', () => ({
  prisma: {
    contact: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({
        id: 'c1', firstName: 'John', lastName: null,
        email: null, phone: null, type: 'customer',
        primaryCompanyId: null, createdAt: new Date(),
      }),
    },
  },
}));
jest.mock('next-auth', () => ({ getServerSession: jest.fn().mockResolvedValue({ user: { name: 'admin' } }) }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));

import { GET, POST } from '@/app/api/contacts/route';
import { NextRequest } from 'next/server';

it('GET returns empty array for no match', async () => {
  const req = new NextRequest('http://localhost/api/contacts?q=zzznomatch');
  const res = await GET(req);
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(Array.isArray(data)).toBe(true);
});

it('POST returns 400 when firstName missing', async () => {
  const req = new NextRequest('http://localhost/api/contacts', {
    method: 'POST',
    body: JSON.stringify({}),
    headers: { 'Content-Type': 'application/json' },
  });
  const res = await POST(req);
  expect(res.status).toBe(400);
});
```

- [ ] **Step 2: Run tests, verify fail**

```bash
npx jest contacts --no-coverage
```

Expected: FAIL — `Cannot find module '@/app/api/contacts/route'`

- [ ] **Step 3: Create `src/app/api/contacts/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = req.nextUrl.searchParams.get('q') ?? '';
  const contacts = await prisma.contact.findMany({
    where: {
      OR: [
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { email: { contains: q } },
      ],
    },
    include: { primaryCompany: true },
    orderBy: { firstName: 'asc' },
    take: 10,
  });
  return NextResponse.json(contacts);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };

  if (!body.firstName?.trim()) {
    return NextResponse.json({ error: 'firstName is required' }, { status: 400 });
  }

  const contact = await prisma.contact.create({
    data: {
      firstName: body.firstName.trim(),
      lastName: body.lastName?.trim() || null,
      email: body.email?.trim().toLowerCase() || null,
      phone: body.phone?.trim() || null,
      type: 'customer',
    },
  });
  return NextResponse.json(contact, { status: 201 });
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
npx jest contacts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/contacts/route.ts src/__tests__/contacts.test.ts
git commit -m "feat: GET/POST /api/contacts — search and inline create"
```

---

## Task 3: Internal Companies API (GET search + POST create)

**Files:**
- Create: `src/app/api/companies/route.ts`
- Create: `src/__tests__/companies.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/__tests__/companies.test.ts

// Mocks MUST come before the import that triggers module loading
jest.mock('@/lib/prisma', () => ({
  prisma: {
    company: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({
        id: 'co1', name: 'Acme Corp', domain: null,
        type: 'customer', createdAt: new Date(),
      }),
    },
  },
}));
jest.mock('next-auth', () => ({ getServerSession: jest.fn().mockResolvedValue({ user: { name: 'admin' } }) }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));

import { GET, POST } from '@/app/api/companies/route';
import { NextRequest } from 'next/server';

it('GET returns empty array for no match', async () => {
  const req = new NextRequest('http://localhost/api/companies?q=zzznomatch');
  const res = await GET(req);
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(Array.isArray(data)).toBe(true);
});

it('POST returns 400 when name missing', async () => {
  const req = new NextRequest('http://localhost/api/companies', {
    method: 'POST',
    body: JSON.stringify({}),
    headers: { 'Content-Type': 'application/json' },
  });
  const res = await POST(req);
  expect(res.status).toBe(400);
});
```

- [ ] **Step 2: Run tests, verify fail**

```bash
npx jest companies --no-coverage
```

- [ ] **Step 3: Create `src/app/api/companies/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = req.nextUrl.searchParams.get('q') ?? '';
  const companies = await prisma.company.findMany({
    where: { name: { contains: q } },
    orderBy: { name: 'asc' },
    take: 10,
  });
  return NextResponse.json(companies);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { name?: string; domain?: string };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const company = await prisma.company.create({
    data: {
      name: body.name.trim(),
      domain: body.domain?.trim().toLowerCase() || null,
      type: 'customer',
    },
  });
  return NextResponse.json(company, { status: 201 });
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
npx jest companies --no-coverage
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/companies/route.ts src/__tests__/companies.test.ts
git commit -m "feat: GET/POST /api/companies — search and inline create"
```

---

## Task 4: Update `claude.ts` — New Types + Streaming Generator

**Files:**
- Modify: `src/lib/claude.ts`

The existing `generateQuoteFromScope` (non-streaming, returns `{ sections, questions }`) is replaced by `generateQuoteStream` which streams NDJSON lines. The old function is kept but deprecated — existing consumers (`/api/quotes/generate`) will be updated in Task 5.

- [ ] **Step 1: Add new types and streaming function**

Replace the contents of `src/lib/claude.ts` with:

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Shared types ──────────────────────────────────────────────────────────────

export interface GeneratedLineItem {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  isMaterial: boolean;
}

export interface GeneratedSection {
  title: string;
  items: GeneratedLineItem[];
}

// ─── Legacy type (kept for backwards compat) ───────────────────────────────────

export interface QuoteGenerationResult {
  sections: GeneratedSection[];
  questions: string[];
}

// ─── Streaming types ───────────────────────────────────────────────────────────

export type StreamEvent =
  | { type: "extracted"; contactName?: string; address?: string; projectType?: string; gaps: string[] }
  | { type: "section"; data: GeneratedSection }
  | { type: "done" };

// ─── Prompts ───────────────────────────────────────────────────────────────────

const BASE_CONTEXT = `You are an expert construction estimator for Building NV, a commercial tenant improvement (TI) contractor based in Reno, Nevada.

Reno NV market context:
- Labor rates: General labor $65-85/hr, Skilled trades $85-120/hr, Electrician $95-130/hr
- LED light swap (supply + install): $140-190 per fixture
- Ceiling tile replacement: $3.50-4.50/SF installed
- LVT flooring: $6-8/SF installed (includes material + labor)
- Cove base: $3-5/LF installed
- Insulation (batts, per piece): $35-50 each
- Drywall: $4-6/SF installed
- Paint: $1.50-2.50/SF (walls), $1-1.50/SF (ceiling)
- Dump fees: $500-1000 per job depending on volume
- Scissor lift rental: $150/day delivery + $125/day rental`;

const STREAM_SYSTEM_PROMPT = `${BASE_CONTEXT}

Your job is to parse a scope of work (which may be a voice transcript, an RFP, typed notes, or contractor shorthand) and output structured data as newline-delimited JSON (NDJSON). Parse intent, not grammar — voice transcripts will have incomplete sentences and measurements embedded in prose.

Output rules:
1. First line: an "extracted" event with whatever you can identify from the input (contact name, job site address, project type) and a "gaps" array listing required fields you could NOT extract. Use these gap key names: "contact_name", "address", "project_type".
2. Then output one "section" event per section of the quote.
3. Final line: a "done" event.
4. Each line must be valid JSON. No markdown, no code blocks, no prose — only NDJSON.
5. Materials (supply-only items) have isMaterial: true. Combined supply+install are isMaterial: false.
6. Keep descriptions tight: "Remove 10 ea. fluorescent lights and install LED lights per code"
7. If you genuinely cannot produce even one line item (e.g., input is gibberish), output a single section with a placeholder item and note the gap.

Example output (3 lines total):
{"type":"extracted","contactName":"John Smith","address":"123 Main St, Reno NV","projectType":"Office Buildout","gaps":[]}
{"type":"section","data":{"title":"Demolition","items":[{"description":"Demo existing partition walls","quantity":1,"unit":"ls","unitPrice":2800,"isMaterial":false}]}}
{"type":"done"}`;

// ─── Streaming generator ────────────────────────────────────────────────────────

/**
 * Streams quote generation as NDJSON events.
 * Yields StreamEvent objects as Claude produces them.
 * Use in a Next.js streaming route handler.
 */
export async function* generateQuoteStream(
  scopeText: string
): AsyncGenerator<StreamEvent> {
  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: STREAM_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Parse and price this scope of work:\n\n${scopeText}`,
      },
    ],
  });

  let buffer = "";

  for await (const chunk of stream) {
    if (
      chunk.type === "content_block_delta" &&
      chunk.delta.type === "text_delta"
    ) {
      buffer += chunk.delta.text;
      const lines = buffer.split("\n");
      // All complete lines (everything except the last partial line)
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        try {
          yield JSON.parse(line) as StreamEvent;
        } catch {
          // Malformed line — skip
        }
      }
      buffer = lines[lines.length - 1]; // keep the partial last line
    }
  }

  // Flush any remaining buffered content
  if (buffer.trim()) {
    try {
      yield JSON.parse(buffer.trim()) as StreamEvent;
    } catch {
      // ignore
    }
  }
}

// ─── Legacy non-streaming function (kept for existing tests) ───────────────────

const LEGACY_SYSTEM_PROMPT = `${BASE_CONTEXT}

Output rules:
1. If you have enough information to price ALL items, return JSON with sections and empty questions array.
2. If you are MISSING specific data needed to price an item accurately, return the questions array with 1-3 specific questions. Do NOT guess.
3. Organize line items into logical sections.
4. Materials (supply-only items) should have isMaterial: true.
5. Combined supply+install items are isMaterial: false.
6. Keep descriptions tight and professional.

Return ONLY valid JSON:
{
  "sections": [{"title": "...", "items": [{"description": "...", "quantity": 1, "unit": "ls", "unitPrice": 2800, "isMaterial": false}]}],
  "questions": []
}`;

export async function generateQuoteFromScope(
  scopeText: string
): Promise<QuoteGenerationResult> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [{ role: "user", content: `Please generate a quote for the following scope of work:\n\n${scopeText}` }],
    system: LEGACY_SYSTEM_PROMPT,
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude did not return valid JSON");
  return JSON.parse(jsonMatch[0]) as QuoteGenerationResult;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Run existing tests to confirm legacy function still works**

```bash
npx jest --no-coverage
```

Expected: all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/claude.ts
git commit -m "feat: add generateQuoteStream — streaming NDJSON generator with extraction"
```

---

## Task 5: Update Generate Route — Streaming Response

**Files:**
- Modify: `src/app/api/quotes/generate/route.ts`

- [ ] **Step 1: Rewrite the route to stream NDJSON**

```typescript
// src/app/api/quotes/generate/route.ts
import { NextRequest } from 'next/server';
import { generateQuoteStream } from '@/lib/claude';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { scopeText } = await req.json();
  if (!scopeText) {
    return NextResponse.json({ error: 'scopeText is required' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of generateQuoteStream(scopeText)) {
          controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
        }
      } catch (err) {
        console.error('Stream error:', err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
    },
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Smoke test the streaming route manually**

Start the dev server (`npm run dev`) and in a separate terminal:

```bash
curl -s -X POST http://localhost:3000/api/quotes/generate \
  -H 'Content-Type: application/json' \
  -b 'next-auth.session-token=<your-session-token>' \
  -d '{"scopeText":"Office buildout, 2000 SF, demo walls, new drywall, paint, LVT floors. Contact: Mike Jones."}' \
  | head -20
```

Expected: newline-delimited JSON lines streaming in, starting with an `extracted` event.

Note: for local testing without a real session token, temporarily remove the session guard, test, then restore it.

- [ ] **Step 4: Update `src/__tests__/quoteGenerate.test.ts`**

The existing test file tests the legacy `generateQuoteFromScope` function (non-streaming) and `POST /api/quotes/generate`. Since the generate route now streams NDJSON, any test that asserts on `{ sections, questions }` response shape is stale. Options:
- If the test imports and tests `generateQuoteFromScope` directly from `src/lib/claude.ts` — it remains valid (legacy function is preserved).
- If the test calls the `/api/quotes/generate` route directly and asserts on its JSON response — delete those assertions or replace with a streaming response check.

Run `npx jest quoteGenerate --no-coverage` first to see what currently passes. Delete any test that asserts the old `{ questions: [...] }` response shape from the route.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/quotes/generate/route.ts src/__tests__/quoteGenerate.test.ts
git commit -m "feat: stream NDJSON from /api/quotes/generate"
```

---

## Task 6: Rewrite `POST /api/quotes`

**Files:**
- Modify: `src/app/api/quotes/route.ts`

The POST handler currently creates a `Client` via upsert. It's replaced with a handler that accepts `contacts` and `companies` arrays and creates `QuoteContact`/`QuoteCompany` records. The GET handler is unchanged.

- [ ] **Step 1: Write failing test**

```typescript
// src/__tests__/quotes/create.test.ts

// Mocks MUST come before the import that triggers module loading
jest.mock('@/lib/prisma', () => ({
  prisma: {
    contact: { findUnique: jest.fn().mockResolvedValue(null) },
    quote: { create: jest.fn() },
    lineItemSection: { create: jest.fn() },
    lineItem: { create: jest.fn() },
  },
}));
jest.mock('next-auth', () => ({ getServerSession: jest.fn().mockResolvedValue({ user: { name: 'admin' } }) }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));

import { POST } from '@/app/api/quotes/route';
import { NextRequest } from 'next/server';

it('returns 400 when address is missing', async () => {
  const req = new NextRequest('http://localhost/api/quotes', {
    method: 'POST',
    body: JSON.stringify({ projectType: 'Office Buildout' }),
    headers: { 'Content-Type': 'application/json' },
  });
  const res = await POST(req);
  expect(res.status).toBe(400);
});
```

- [ ] **Step 2: Run test, verify fail**

```bash
npx jest quotes/create --no-coverage
```

- [ ] **Step 3: Rewrite `POST /api/quotes`**

Replace only the `POST` function in `src/app/api/quotes/route.ts` (keep `GET` as-is). The existing file already imports `generateQuoteSlug` from `@/lib/slug` at the top — confirm that import is present before replacing the POST body. If for any reason it's missing, add:

```typescript
import { generateQuoteSlug } from "@/lib/slug";
```

```typescript
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    address?: string;
    projectType?: string;
    projectId?: string;
    contacts?: { contactId: string; role: string }[];
    companies?: { companyId: string; role: string }[];
    sections?: { title: string; items: { description: string; quantity: number; unit: string; unitPrice: number; isMaterial: boolean }[] }[];
  };

  if (!body.address?.trim()) {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }
  if (!body.projectType?.trim()) {
    return NextResponse.json({ error: "projectType is required" }, { status: 400 });
  }

  // Look up first contact's name for a human-readable slug
  let slugClientName = "";
  if (body.contacts?.[0]?.contactId) {
    const c = await prisma.contact.findUnique({
      where: { id: body.contacts[0].contactId },
      select: { firstName: true, lastName: true },
    });
    if (c) slugClientName = `${c.firstName} ${c.lastName ?? ""}`.trim();
  }
  const slug = generateQuoteSlug(slugClientName, body.address!);

  const quote = await prisma.quote.create({
    data: {
      slug,
      title: `${body.address} — ${body.projectType}`,
      address: body.address.trim(),
      projectType: body.projectType.trim(),
      clientId: null,
      projectId: body.projectId ?? null,
      quoteContacts: body.contacts?.length
        ? { create: body.contacts.map((c) => ({ contactId: c.contactId, role: c.role })) }
        : undefined,
      quoteCompanies: body.companies?.length
        ? { create: body.companies.map((c) => ({ companyId: c.companyId, role: c.role })) }
        : undefined,
    },
  });

  // Save sections if provided (happens when AI draft is accepted)
  if (body.sections?.length) {
    for (let si = 0; si < body.sections.length; si++) {
      const sec = body.sections[si];
      const section = await prisma.lineItemSection.create({
        data: { quoteId: quote.id, title: sec.title, position: si },
      });
      for (let li = 0; li < sec.items.length; li++) {
        const item = sec.items[li];
        await prisma.lineItem.create({
          data: {
            sectionId: section.id,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            isMaterial: item.isMaterial ?? false,
            position: li,
          },
        });
      }
    }
  }

  // Re-fetch to include all relations (including sections saved above)
  const finalQuote = await prisma.quote.findUnique({
    where: { id: quote.id },
    include: {
      quoteContacts: { include: { contact: true } },
      quoteCompanies: { include: { company: true } },
      sections: {
        include: { items: { orderBy: { position: "asc" } } },
        orderBy: { position: "asc" },
      },
    },
  });
  return NextResponse.json(finalQuote, { status: 201 });
}
```

- [ ] **Step 4: Run test, verify pass**

```bash
npx jest quotes/create --no-coverage
```

- [ ] **Step 5: Verify full test suite**

```bash
npx jest --no-coverage
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/quotes/route.ts src/__tests__/quotes/create.test.ts
git commit -m "feat: rewrite POST /api/quotes — accepts QuoteContact/QuoteCompany, no Client creation"
```

---

## Task 7: Rewrite New Quote Page

**Files:**
- Modify: `src/app/internal/quotes/new/page.tsx` (full rewrite)

> **Architecture note vs. spec:** The spec says creating and editing should be "the same surface" with `QuoteEditor` embedded. This plan deviates from that: the new quote page renders a read-only streaming draft, then **redirects** to the `/internal/quotes/[id]/edit` page (which already embeds QuoteEditor). The end result is functionally equivalent — the user immediately lands in QuoteEditor after saving. Embedding QuoteEditor inline in the intake page is deferred; the streaming draft view is lighter and ships faster.

This is the largest task. The page is a single client component with four states:

1. **idle** — textarea input + mode toggle
2. **streaming** — draft renders progressively as NDJSON events arrive
3. **draft** — full draft rendered, gap callouts shown, editable
4. **saving** — POST to create quote, then redirect to edit page

The gap callout labels map lives in this file. The contact/company type-ahead is a self-contained sub-component defined in the same file.

- [ ] **Step 1: Write the new page**

```typescript
// src/app/internal/quotes/new/page.tsx
"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface LineItem {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  isMaterial: boolean;
}

interface Section {
  title: string;
  items: LineItem[];
}

interface Extracted {
  contactName?: string;
  address?: string;
  projectType?: string;
  gaps: string[];
}

interface ContactResult {
  id: string;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface CompanyResult {
  id: string;
  name: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const GAP_LABELS: Record<string, string> = {
  contact_name: "Who's the contact on this job?",
  address: "Confirm the job site address:",
  project_type: "What type of project is this?",
};

const PROJECT_TYPES = [
  "Office Buildout",
  "Retail / Restaurant",
  "Medical Suite",
  "Warehouse / Industrial",
  "Suite Renovation",
  "Light Maintenance / Repair",
  "Other",
];

const inputClass =
  "w-full bg-surface border border-border rounded-sm px-4 py-3 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent transition-colors";

// ─── ContactSearch sub-component ───────────────────────────────────────────────

function ContactSearch({
  onSelect,
}: {
  onSelect: (contact: ContactResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ContactResult[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [creating, setCreating] = useState(false);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    const res = await fetch(`/api/contacts?q=${encodeURIComponent(q)}`);
    setResults(await res.json());
  }, []);

  const handleCreate = async () => {
    if (!newFirst.trim()) return;
    setCreating(true);
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: newFirst, lastName: newLast, phone: newPhone }),
    });
    const contact = await res.json();
    onSelect(contact);
    setCreating(false);
    setShowCreate(false);
  };

  if (showCreate) {
    return (
      <div className="border border-border rounded-sm p-4 flex flex-col gap-3">
        <p className="text-text-muted text-xs uppercase tracking-widest">New Contact</p>
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="First name *" value={newFirst} onChange={(e) => setNewFirst(e.target.value)} className={inputClass} />
          <input placeholder="Last name" value={newLast} onChange={(e) => setNewLast(e.target.value)} className={inputClass} />
        </div>
        <input placeholder="Phone" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} className={inputClass} />
        <div className="flex gap-2">
          <button onClick={handleCreate} disabled={!newFirst.trim() || creating}
            className="bg-accent text-bg px-4 py-2 rounded-sm text-sm font-semibold hover:bg-accent/90 disabled:opacity-50 transition-colors">
            {creating ? "Creating…" : "Add Contact"}
          </button>
          <button onClick={() => setShowCreate(false)}
            className="border border-border text-text-muted px-4 py-2 rounded-sm text-sm hover:border-text-muted transition-colors">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); search(e.target.value); }}
        placeholder="Search contacts…"
        className={inputClass}
      />
      {results.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-surface border border-border rounded-sm shadow-lg z-10 mt-1">
          {results.map((c) => (
            <button key={c.id} onClick={() => { onSelect(c); setQuery(""); setResults([]); }}
              className="w-full text-left px-4 py-3 hover:bg-surface-2 transition-colors text-sm">
              <span className="text-text-primary font-medium">{c.firstName} {c.lastName}</span>
              {c.phone && <span className="text-text-muted ml-2">{c.phone}</span>}
            </button>
          ))}
        </div>
      )}
      {query.length > 1 && results.length === 0 && (
        <button onClick={() => { setShowCreate(true); setNewFirst(query); setQuery(""); }}
          className="absolute top-full left-0 right-0 bg-surface border border-border rounded-sm mt-1 px-4 py-3 text-sm text-accent hover:bg-surface-2 transition-colors text-left z-10">
          + Create "{query}" as new contact
        </button>
      )}
    </div>
  );
}

// ─── CompanySearch sub-component ───────────────────────────────────────────────

function CompanySearch({ onSelect }: { onSelect: (company: CompanyResult) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CompanyResult[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    const res = await fetch(`/api/companies?q=${encodeURIComponent(q)}`);
    setResults(await res.json());
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    const company = await res.json();
    onSelect(company);
    setCreating(false);
    setShowCreate(false);
  };

  if (showCreate) {
    return (
      <div className="border border-border rounded-sm p-4 flex flex-col gap-3">
        <p className="text-text-muted text-xs uppercase tracking-widest">New Company</p>
        <input placeholder="Company name *" value={newName} onChange={(e) => setNewName(e.target.value)} className={inputClass} />
        <div className="flex gap-2">
          <button onClick={handleCreate} disabled={!newName.trim() || creating}
            className="bg-accent text-bg px-4 py-2 rounded-sm text-sm font-semibold hover:bg-accent/90 disabled:opacity-50 transition-colors">
            {creating ? "Creating…" : "Add Company"}
          </button>
          <button onClick={() => setShowCreate(false)}
            className="border border-border text-text-muted px-4 py-2 rounded-sm text-sm hover:border-text-muted transition-colors">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); search(e.target.value); }}
        placeholder="Search companies…"
        className={inputClass}
      />
      {results.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-surface border border-border rounded-sm shadow-lg z-10 mt-1">
          {results.map((c) => (
            <button key={c.id} onClick={() => { onSelect(c); setQuery(""); setResults([]); }}
              className="w-full text-left px-4 py-3 hover:bg-surface-2 transition-colors text-sm text-text-primary">
              {c.name}
            </button>
          ))}
        </div>
      )}
      {query.length > 1 && results.length === 0 && (
        <button onClick={() => { setShowCreate(true); setNewName(query); setQuery(""); }}
          className="absolute top-full left-0 right-0 bg-surface border border-border rounded-sm mt-1 px-4 py-3 text-sm text-accent hover:bg-surface-2 transition-colors text-left z-10">
          + Create "{query}" as new company
        </button>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

type Mode = "ai" | "manual";
type Phase = "idle" | "streaming" | "draft" | "saving";

export default function NewQuotePage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("ai");
  const [phase, setPhase] = useState<Phase>("idle");
  const [scopeText, setScopeText] = useState("");

  // CRM links
  const [selectedContact, setSelectedContact] = useState<ContactResult | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<CompanyResult | null>(null);
  const [companyRole, setCompanyRole] = useState("tenant");

  // Manual fields (also used to resolve gaps)
  const [address, setAddress] = useState("");
  const [projectType, setProjectType] = useState("");

  // Draft state
  const [sections, setSections] = useState<Section[]>([]);
  const [gaps, setGaps] = useState<string[]>([]);
  const [streamStatus, setStreamStatus] = useState("");

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const grandTotal = sections.reduce(
    (t, s) => t + s.items.reduce((st, i) => st + i.quantity * i.unitPrice, 0),
    0
  );

  // ── Generate (AI mode) ──────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!scopeText.trim()) return;
    setPhase("streaming");
    setStreamStatus("Analyzing scope…");
    setSections([]);
    setGaps([]);

    const res = await fetch("/api/quotes/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scopeText }),
    });

    if (!res.body) { setPhase("idle"); return; }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.type === "extracted") {
            if (event.address && !address) setAddress(event.address);
            if (event.projectType && !projectType) setProjectType(event.projectType);
            // Always require a real CRM Contact to be linked — even if Claude
            // extracted a name, we still need the user to select or create one.
            const baseGaps: string[] = event.gaps ?? [];
            if (!selectedContact && !baseGaps.includes("contact_name")) {
              setGaps([...baseGaps, "contact_name"]);
            } else {
              setGaps(baseGaps);
            }
            setStreamStatus("Generating line items…");
          } else if (event.type === "section") {
            setSections((prev) => [...prev, event.data]);
            setStreamStatus("");
          } else if (event.type === "done") {
            setPhase("draft");
          }
        } catch {
          // malformed line — skip
        }
      }
    }

    setPhase("draft");
  };

  // ── Save quote ──────────────────────────────────────────────────────────────

  // Require a linked contact — extracted contact name alone is not enough.
  // gaps.length === 0 does NOT substitute for a real CRM Contact link.
  const canSave =
    selectedContact !== null &&
    address.trim() !== "" &&
    projectType.trim() !== "" &&
    sections.length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setPhase("saving");

    const res = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address,
        projectType,
        contacts: selectedContact
          ? [{ contactId: selectedContact.id, role: "decision_maker" }]
          : [],
        companies: selectedCompany
          ? [{ companyId: selectedCompany.id, role: companyRole }]
          : [],
        sections,
      }),
    });

    if (!res.ok) { setPhase("draft"); return; }
    const quote = await res.json();
    router.push(`/internal/quotes/${quote.id}/edit`);
  };

  // ── Gap resolution helpers ──────────────────────────────────────────────────

  const resolveGap = (key: string) =>
    setGaps((prev) => prev.filter((g) => g !== key));

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-text-primary">New Quote</h1>
        {phase === "idle" && (
          <div className="flex gap-1 border border-border rounded-sm p-0.5">
            {(["ai", "manual"] as Mode[]).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-4 py-1.5 rounded-sm text-sm font-medium transition-colors ${mode === m ? "bg-accent text-bg" : "text-text-muted hover:text-text-primary"}`}>
                {m === "ai" ? "AI Draft" : "Manual"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Contacts / Companies (always visible) ── */}
      <div className="flex flex-col gap-4 mb-6">
        <div>
          <p className="text-text-muted text-xs uppercase tracking-widest mb-2">Contact</p>
          {selectedContact ? (
            <div className="flex items-center justify-between border border-border rounded-sm px-4 py-3">
              <span className="text-text-primary text-sm font-medium">
                {selectedContact.firstName} {selectedContact.lastName}
                {selectedContact.phone && <span className="text-text-muted font-normal ml-2">{selectedContact.phone}</span>}
              </span>
              <button onClick={() => setSelectedContact(null)} className="text-text-muted hover:text-text-primary text-lg leading-none">×</button>
            </div>
          ) : (
            <ContactSearch onSelect={(c) => { setSelectedContact(c); resolveGap("contact_name"); }} />
          )}
        </div>

        <div>
          <p className="text-text-muted text-xs uppercase tracking-widest mb-2">Company <span className="normal-case text-text-muted font-normal">(optional)</span></p>
          {selectedCompany ? (
            <div className="flex items-center justify-between border border-border rounded-sm px-4 py-3">
              <span className="text-text-primary text-sm">{selectedCompany.name}</span>
              <div className="flex items-center gap-3">
                <select value={companyRole} onChange={(e) => setCompanyRole(e.target.value)}
                  className="bg-surface-2 border border-border rounded-sm px-2 py-1 text-text-muted text-xs focus:outline-none">
                  <option value="tenant">Tenant</option>
                  <option value="landlord">Landlord</option>
                  <option value="property_manager">Property Manager</option>
                  <option value="owner">Owner</option>
                </select>
                <button onClick={() => setSelectedCompany(null)} className="text-text-muted hover:text-text-primary text-lg leading-none">×</button>
              </div>
            </div>
          ) : (
            <CompanySearch onSelect={setSelectedCompany} />
          )}
        </div>
      </div>

      {/* ── Address + Project Type ── */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-text-muted text-xs uppercase tracking-widest mb-2">Job Site Address</p>
          <input value={address} onChange={(e) => { setAddress(e.target.value); if (e.target.value) resolveGap("address"); }}
            placeholder="123 Main St, Reno NV" className={inputClass} />
        </div>
        <div>
          <p className="text-text-muted text-xs uppercase tracking-widest mb-2">Project Type</p>
          <select value={projectType} onChange={(e) => { setProjectType(e.target.value); if (e.target.value) resolveGap("project_type"); }}
            className={`${inputClass} appearance-none`}>
            <option value="" disabled>Select type…</option>
            {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* ── AI scope input (AI mode, idle only) ── */}
      {mode === "ai" && phase === "idle" && (
        <div className="mb-6">
          <p className="text-text-muted text-xs uppercase tracking-widest mb-2">Scope / RFP / Transcript</p>
          <textarea
            value={scopeText}
            onChange={(e) => setScopeText(e.target.value)}
            rows={10}
            placeholder="Paste scope of work, RFP, or voice transcript…"
            className={`${inputClass} resize-none`}
          />
          <button onClick={handleGenerate} disabled={!scopeText.trim()}
            className="mt-3 w-full bg-accent text-bg font-semibold py-3 rounded-sm text-sm hover:bg-accent/90 disabled:opacity-50 transition-colors">
            Generate Quote Draft
          </button>
        </div>
      )}

      {/* ── Streaming status ── */}
      {phase === "streaming" && (
        <div className="mb-4 flex items-center gap-2 text-text-muted text-sm">
          <span className="inline-block w-3 h-3 rounded-full bg-accent animate-pulse" />
          {streamStatus || "Generating…"}
        </div>
      )}

      {/* ── Gap callouts ── */}
      {(phase === "streaming" || phase === "draft") && gaps.length > 0 && (
        <div className="flex flex-col gap-2 mb-6">
          {gaps.map((gap) => (
            <div key={gap} className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-sm px-4 py-3 text-sm">
              <span className="text-amber-400">⚠</span>
              <span className="text-text-primary flex-1">{GAP_LABELS[gap] ?? gap}</span>
              <button onClick={() => resolveGap(gap)} className="text-text-muted text-xs hover:text-text-primary">dismiss</button>
            </div>
          ))}
        </div>
      )}

      {/* ── Draft line items ── */}
      {sections.length > 0 && (
        <div className="flex flex-col gap-6 mb-8">
          {sections.map((sec, si) => (
            <div key={si} className="border border-border rounded-sm">
              <div className="px-4 py-3 border-b border-border bg-surface">
                <span className="text-text-primary font-medium text-sm">{sec.title}</span>
              </div>
              <div className="divide-y divide-border">
                {sec.items.map((item, ii) => (
                  <div key={ii} className="px-4 py-3 grid grid-cols-12 gap-3 items-center text-sm">
                    <span className="col-span-6 text-text-primary">{item.description}</span>
                    <span className="col-span-2 text-text-muted text-right">
                      {item.quantity === 1 && item.unit.toLowerCase() === "ls"
                        ? "Flat Rate"
                        : `${item.quantity.toLocaleString("en-US")} ${item.unit}`}
                    </span>
                    <span className="col-span-2 text-text-muted text-right">${fmt(item.unitPrice)}</span>
                    <span className="col-span-2 text-text-primary text-right font-medium">
                      ${fmt(item.quantity * item.unitPrice)}
                    </span>
                  </div>
                ))}
                <div className="px-4 py-3 grid grid-cols-12 gap-3 text-sm bg-surface">
                  <span className="col-span-10 text-text-muted text-right text-xs font-medium uppercase tracking-wider">Subtotal</span>
                  <span className="col-span-2 text-text-primary text-right font-semibold">
                    ${fmt(sec.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0))}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {/* Grand total */}
          <div className="border border-border rounded-sm px-4 py-4 grid grid-cols-12 gap-3 items-center">
            <span className="col-span-10 text-text-muted text-right text-sm font-semibold uppercase tracking-wider">Grand Total</span>
            <span className="col-span-2 text-text-primary text-right text-xl font-bold">${fmt(grandTotal)}</span>
          </div>

          {/* Save button */}
          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={!canSave || phase === "saving"}
              className="bg-accent text-bg font-semibold px-6 py-3 rounded-sm text-sm hover:bg-accent/90 disabled:opacity-50 transition-colors">
              {phase === "saving" ? "Saving…" : "Save & Edit Quote"}
            </button>
            {!canSave && (
              <p className="text-text-muted text-sm">
                {!selectedContact
                  ? "Search or create a contact to save"
                  : !address
                  ? "Add a job site address to save"
                  : !projectType
                  ? "Select a project type to save"
                  : "Add at least one line item to save"}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Manual mode: empty editor placeholder ── */}
      {mode === "manual" && phase === "idle" && (
        <div className="border border-dashed border-border rounded-sm p-8 text-center">
          <p className="text-text-muted text-sm mb-4">Fill in contact, address, and project type above, then save to open the quote editor.</p>
          <button
            onClick={async () => {
              if (!address.trim() || !projectType.trim()) return;
              setPhase("saving");
              const res = await fetch("/api/quotes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  address,
                  projectType,
                  contacts: selectedContact ? [{ contactId: selectedContact.id, role: "decision_maker" }] : [],
                  companies: selectedCompany ? [{ companyId: selectedCompany.id, role: companyRole }] : [],
                  sections: [],
                }),
              });
              if (res.ok) {
                const quote = await res.json();
                router.push(`/internal/quotes/${quote.id}/edit`);
              } else {
                setPhase("idle");
              }
            }}
            disabled={!address.trim() || !projectType.trim()}
            className="bg-accent text-bg font-semibold px-6 py-3 rounded-sm text-sm hover:bg-accent/90 disabled:opacity-50 transition-colors">
            Create Blank Quote
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Start dev server and smoke test**

```bash
npm run dev
```

Verify the following manually at `http://localhost:3000/internal/quotes/new`:

1. Page loads in AI mode. Mode toggle visible.
2. Contact search: type 2+ characters → results appear → click to select → contact chip shown with × to clear
3. "Create new contact" flow: type a name with no results → "+ Create X" appears → click → form shows (name + phone only, no email required) → submit → chip appears
4. Company search: same pattern
5. Paste a scope transcript into the textarea → click Generate → streaming status appears → sections render as they arrive
6. Gap callouts appear for missing required fields
7. Resolve gaps by filling address/project type or selecting contact → callouts dismiss
8. "Save & Edit Quote" activates when minimum set is met → creates quote → redirects to edit page
9. Manual mode: switch to Manual → textarea hidden → "Create Blank Quote" button → redirects to empty editor

- [ ] **Step 4: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/internal/quotes/new/page.tsx
git commit -m "feat: new quote page — streaming draft, contact/company search, gap callouts, manual mode"
```

---

## Task 8: Update Quotes List Page (status badge fix)

**Files:**
- Modify: `src/app/internal/quotes/page.tsx`

The quotes list page shows a `quote_signed` badge but `statusColors` only maps `draft`, `sent`, `accepted`. Minor fix.

- [ ] **Step 1: Update status color map**

In `src/app/internal/quotes/page.tsx`, replace `statusColors`:

```typescript
const statusColors: Record<string, string> = {
  draft: "text-text-muted border-border",
  sent: "text-accent border-accent",
  accepted: "text-green-400 border-green-400",
  quote_signed: "text-green-400 border-green-400",
};
```

- [ ] **Step 2: Commit**

```bash
git add src/app/internal/quotes/page.tsx
git commit -m "fix: add quote_signed status color to quotes list"
```

---

## Task 9: End-to-End Smoke Test

Manual walkthrough — verify the full chain works:

- [ ] Go to `/internal/quotes/new`
- [ ] Search for an existing contact → select → chip appears
- [ ] Create a new contact (name + phone only, no email) → chip appears
- [ ] Search for an existing company or create new one
- [ ] Paste a short scope: "Demo existing partition walls, install new 2x4 metal stud framing at 400 SF, hang and tape drywall, paint." → click Generate
- [ ] Verify streaming: status text appears, sections populate progressively
- [ ] Verify gap callouts appear if address/project type missing
- [ ] Fill in address + select project type → callouts resolve
- [ ] "Save & Edit Quote" activates → click → redirected to QuoteEditor
- [ ] Verify quote appears in `/internal/quotes` list with correct client name
- [ ] Verify quote has `clientId = null` in DB (new record, not a Client orphan)
- [ ] Switch to Manual mode → create a blank quote → verify redirect to empty editor
- [ ] Run full test suite one final time: `npx jest --no-coverage`

- [ ] **Commit any fixes from smoke test**

```bash
git add -A && git commit -m "fix: smoke test corrections for quote creation redesign"
```
