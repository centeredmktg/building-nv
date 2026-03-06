# Quoting Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an internal quoting engine inside the existing Next.js app where estimators ingest a scope of work, Claude AI generates a structured editable quote, and a shareable proposal page is sent to clients for acceptance.

**Architecture:** Protected `/app/(internal)/` route group (NextAuth credentials), SQLite via Prisma for storage, Claude API for scope parsing and line-item generation, public `/proposals/[slug]` page with print CSS for client delivery. All within the existing Next.js repo — no new infrastructure.

**Tech Stack:** Next.js 14+ App Router, NextAuth.js, Prisma + SQLite, `@anthropic-ai/sdk`, Tailwind CSS, Jest + React Testing Library.

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json` (via npm install)

**Step 1: Install all quoting engine dependencies**

```bash
npm install @prisma/client next-auth @anthropic-ai/sdk
npm install -D prisma @types/bcryptjs bcryptjs jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom ts-jest
```

**Step 2: Initialize Prisma**

```bash
npx prisma init --datasource-provider sqlite
```

This creates `prisma/schema.prisma` and adds `DATABASE_URL` to `.env`.

**Step 3: Verify Prisma initialized**

```bash
ls prisma/
```

Expected: `schema.prisma` present.

**Step 4: Configure Jest — create `jest.config.ts`**

```typescript
import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testPathPattern: ["src/__tests__/**/*.test.ts"],
};

export default config;
```

**Step 5: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "jest"
```

**Step 6: Commit**

```bash
git add package.json package-lock.json prisma/ jest.config.ts .env
git commit -m "feat: install quoting engine dependencies (Prisma, NextAuth, Anthropic, Jest)"
```

---

## Task 2: Database Schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Replace schema.prisma with the full quoting schema**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Client {
  id         String   @id @default(cuid())
  name       String
  company    String?
  email      String?
  phone      String?
  createdAt  DateTime @default(now())
  quotes     Quote[]
}

model Quote {
  id                  String              @id @default(cuid())
  slug                String              @unique
  title               String
  address             String
  projectType         String
  status              String              @default("draft") // draft | sent | accepted
  scopeText           String?
  materialMarkupPct   Float               @default(10)
  overheadPct         Float               @default(10)
  profitPct           Float               @default(10)
  paymentTerms        String              @default("10% due at signing. 25% due after materials purchased. Balance due net 30.")
  exclusions          String              @default("Plans. Permit fees. Any work not specifically described above. All valuables and personal property to be removed from work areas prior to work.")
  notes               String?
  clientId            String
  client              Client              @relation(fields: [clientId], references: [id])
  sections            LineItemSection[]
  acceptance          Acceptance?
  createdAt           DateTime            @default(now())
  updatedAt           DateTime            @updatedAt
  sentAt              DateTime?
}

model LineItemSection {
  id        String     @id @default(cuid())
  title     String
  position  Int
  quoteId   String
  quote     Quote      @relation(fields: [quoteId], references: [id], onDelete: Cascade)
  items     LineItem[]
}

model LineItem {
  id          String          @id @default(cuid())
  description String
  quantity    Float
  unit        String          @default("ea") // ea, SF, LF, LS, hr
  unitPrice   Float
  isMaterial  Boolean         @default(false)
  position    Int
  sectionId   String
  section     LineItemSection @relation(fields: [sectionId], references: [id], onDelete: Cascade)
}

model Acceptance {
  id          String   @id @default(cuid())
  signerName  String
  acceptedAt  DateTime @default(now())
  ipAddress   String?
  quoteId     String   @unique
  quote       Quote    @relation(fields: [quoteId], references: [id])
}
```

**Step 2: Run migration**

```bash
npx prisma migrate dev --name init
```

Expected: `prisma/migrations/` folder created, `dev.db` created.

**Step 3: Generate Prisma client**

```bash
npx prisma generate
```

**Step 4: Create Prisma client singleton — `src/lib/prisma.ts`**

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

**Step 5: Commit**

```bash
git add prisma/ src/lib/prisma.ts
git commit -m "feat: add database schema and Prisma client singleton"
```

---

## Task 3: Pricing Utility (Pure Functions)

**Files:**
- Create: `src/lib/pricing.ts`
- Create: `src/__tests__/pricing.test.ts`

**Step 1: Write the failing tests first**

Create `src/__tests__/pricing.test.ts`:

```typescript
import { calculateQuoteTotals } from "@/lib/pricing";

describe("calculateQuoteTotals", () => {
  const baseItems = [
    { unitPrice: 100, quantity: 2, isMaterial: false }, // labor: $200
    { unitPrice: 50, quantity: 4, isMaterial: true },   // materials: $200
  ];

  it("calculates subtotal correctly", () => {
    const result = calculateQuoteTotals(baseItems, 10, 10, 10);
    expect(result.subtotal).toBe(400);
  });

  it("applies materials markup only to material items", () => {
    const result = calculateQuoteTotals(baseItems, 10, 10, 10);
    expect(result.materialsMarkupAmount).toBe(20); // 10% of $200
  });

  it("applies overhead to subtotal", () => {
    const result = calculateQuoteTotals(baseItems, 10, 10, 10);
    expect(result.overheadAmount).toBe(40); // 10% of $400
  });

  it("applies profit to subtotal", () => {
    const result = calculateQuoteTotals(baseItems, 10, 10, 10);
    expect(result.profitAmount).toBe(40); // 10% of $400
  });

  it("calculates total correctly", () => {
    const result = calculateQuoteTotals(baseItems, 10, 10, 10);
    expect(result.total).toBe(500); // 400 + 20 + 40 + 40
  });

  it("handles zero percentages", () => {
    const result = calculateQuoteTotals(baseItems, 0, 0, 0);
    expect(result.total).toBe(400);
  });

  it("handles empty line items", () => {
    const result = calculateQuoteTotals([], 10, 10, 10);
    expect(result.total).toBe(0);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `calculateQuoteTotals` not found.

**Step 3: Implement pricing.ts**

```typescript
export interface PricingItem {
  unitPrice: number;
  quantity: number;
  isMaterial: boolean;
}

export interface QuoteTotals {
  subtotal: number;
  materialsSubtotal: number;
  materialsMarkupAmount: number;
  overheadAmount: number;
  profitAmount: number;
  total: number;
}

export function calculateQuoteTotals(
  items: PricingItem[],
  materialMarkupPct: number,
  overheadPct: number,
  profitPct: number
): QuoteTotals {
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const materialsSubtotal = items
    .filter((i) => i.isMaterial)
    .reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const materialsMarkupAmount = round2(materialsSubtotal * (materialMarkupPct / 100));
  const overheadAmount = round2(subtotal * (overheadPct / 100));
  const profitAmount = round2(subtotal * (profitPct / 100));
  const total = round2(subtotal + materialsMarkupAmount + overheadAmount + profitAmount);

  return {
    subtotal: round2(subtotal),
    materialsSubtotal: round2(materialsSubtotal),
    materialsMarkupAmount,
    overheadAmount,
    profitAmount,
    total,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: All 7 tests PASS.

**Step 5: Commit**

```bash
git add src/lib/pricing.ts src/__tests__/pricing.test.ts
git commit -m "feat: add quote pricing utility with tests"
```

---

## Task 4: Slug Utility

**Files:**
- Create: `src/lib/slug.ts`
- Create: `src/__tests__/slug.test.ts`

**Step 1: Write failing tests**

```typescript
// src/__tests__/slug.test.ts
import { generateQuoteSlug } from "@/lib/slug";

describe("generateQuoteSlug", () => {
  it("generates a slug with date prefix", () => {
    const slug = generateQuoteSlug("Hallmark LLC", "50 Freeport #1-8");
    expect(slug).toMatch(/^\d{4}-\d{2}-\d{2}-/);
  });

  it("lowercases and hyphenates client name", () => {
    const slug = generateQuoteSlug("Hallmark LLC", "50 Freeport");
    expect(slug).toContain("hallmark-llc");
  });

  it("lowercases and hyphenates address", () => {
    const slug = generateQuoteSlug("Acme", "50 Freeport #1-8");
    expect(slug).toContain("50-freeport-1-8");
  });

  it("removes special characters except hyphens", () => {
    const slug = generateQuoteSlug("Smith & Sons, Inc.", "123 Main St.");
    expect(slug).not.toMatch(/[&,\.]/);
  });
});
```

**Step 2: Run to verify FAIL**

```bash
npm test
```

**Step 3: Implement slug.ts**

```typescript
export function generateQuoteSlug(clientName: string, address: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const toSlug = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");

  return `${date}-${toSlug(clientName)}-${toSlug(address)}`;
}
```

**Step 4: Run to verify PASS**

```bash
npm test
```

**Step 5: Commit**

```bash
git add src/lib/slug.ts src/__tests__/slug.test.ts
git commit -m "feat: add quote slug generator with tests"
```

---

## Task 5: NextAuth Configuration

**Files:**
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/lib/auth.ts`
- Modify: `.env`

**Step 1: Add auth env vars to .env**

Add to `.env`:
```
NEXTAUTH_SECRET=replace-with-a-random-32-char-string
NEXTAUTH_URL=http://localhost:3000
INTERNAL_PASSWORD=replace-with-your-password
INTERNAL_USERNAME=admin
```

Generate a secret:
```bash
openssl rand -base64 32
```

Paste the output as `NEXTAUTH_SECRET`.

**Step 2: Create auth config — `src/lib/auth.ts`**

```typescript
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (
          credentials?.username === process.env.INTERNAL_USERNAME &&
          credentials?.password === process.env.INTERNAL_PASSWORD
        ) {
          return { id: "1", name: credentials.username };
        }
        return null;
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/internal/login" },
};
```

**Step 3: Create NextAuth route handler**

```typescript
// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

**Step 4: Create middleware — `src/middleware.ts`**

```typescript
export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/internal/:path*"],
};
```

**Step 5: Create login page — `src/app/internal/login/page.tsx`**

```typescript
"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      username: form.get("username"),
      password: form.get("password"),
      redirect: false,
    });
    if (result?.ok) {
      router.push("/internal/quotes");
    } else {
      setError("Invalid credentials");
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-text-primary mb-2">Building NV</h1>
        <p className="text-text-muted text-sm mb-8">Internal Portal</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            name="username"
            type="text"
            placeholder="Username"
            required
            className="w-full bg-surface border border-border rounded-sm px-4 py-3 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent"
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            required
            className="w-full bg-surface border border-border rounded-sm px-4 py-3 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full bg-accent text-bg font-semibold py-3 rounded-sm text-sm hover:bg-accent/90 transition-colors"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
```

**Step 6: Add SessionProvider to root layout**

Create `src/app/providers.tsx`:

```typescript
"use client";

import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

Modify `src/app/layout.tsx` — wrap `{children}` with `<Providers>`:

```typescript
import { Providers } from "./providers";
// ...
<body className="font-sans bg-bg text-text-primary antialiased">
  <Providers>{children}</Providers>
</body>
```

**Step 7: Verify auth works**

```bash
npm run dev
```

Visit `http://localhost:3000/internal/quotes` — should redirect to `/internal/login`. Sign in with credentials from `.env`. Should redirect to `/internal/quotes` (404 is fine for now — route doesn't exist yet).

**Step 8: Commit**

```bash
git add src/app/api/auth/ src/lib/auth.ts src/middleware.ts src/app/internal/login/ src/app/providers.tsx src/app/layout.tsx
git commit -m "feat: add NextAuth credentials auth for internal portal"
```

---

## Task 6: Internal Layout

**Files:**
- Create: `src/app/internal/layout.tsx`
- Create: `src/components/internal/InternalNav.tsx`

**Step 1: Create internal nav component**

```typescript
// src/components/internal/InternalNav.tsx
"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";

export default function InternalNav() {
  return (
    <nav className="border-b border-border bg-surface px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-8">
        <Link href="/internal/quotes" className="text-text-primary font-bold text-lg">
          Building NV
        </Link>
        <Link href="/internal/quotes" className="text-text-muted hover:text-text-primary text-sm transition-colors">
          Quotes
        </Link>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: "/internal/login" })}
        className="text-text-muted hover:text-text-primary text-sm transition-colors"
      >
        Sign Out
      </button>
    </nav>
  );
}
```

**Step 2: Create internal layout**

```typescript
// src/app/internal/layout.tsx
import InternalNav from "@/components/internal/InternalNav";

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <InternalNav />
      <main className="max-w-7xl mx-auto px-6 py-10">{children}</main>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/app/internal/layout.tsx src/components/internal/InternalNav.tsx
git commit -m "feat: add internal portal layout and nav"
```

---

## Task 7: Claude API Service

**Files:**
- Create: `src/lib/claude.ts`

**Step 1: Add Anthropic API key to .env**

Add to `.env`:
```
ANTHROPIC_API_KEY=your-api-key-here
```

Get the key from console.anthropic.com.

**Step 2: Create claude.ts**

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

export interface QuoteGenerationResult {
  sections: GeneratedSection[];
  questions: string[];
}

const SYSTEM_PROMPT = `You are an expert construction estimator for Building NV, a commercial tenant improvement (TI) contractor based in Reno, Nevada.

Your job is to parse a scope of work and generate a detailed, priced quote with line items organized into sections.

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
- Scissor lift rental: $150/day delivery + $125/day rental

Output rules:
1. If you have enough information to price ALL items, return JSON with sections and empty questions array.
2. If you are MISSING specific data needed to price an item accurately (square footage, fixture count, etc.), return the questions array with 1-3 specific questions. Do NOT guess.
3. Organize line items into logical sections: by unit, by trade, or by space type.
4. Materials (supply-only items) should have isMaterial: true.
5. Combined supply+install items are isMaterial: false (labor-dominant).
6. Keep descriptions tight and professional — match the style: "Remove 10 ea. fluorescent lights and install LED lights per code"

Return ONLY valid JSON in this exact format:
{
  "sections": [
    {
      "title": "Unit 1 - Office",
      "items": [
        {
          "description": "Remove and replace fluorescent lights with LED per code",
          "quantity": 10,
          "unit": "ea",
          "unitPrice": 190,
          "isMaterial": false
        }
      ]
    }
  ],
  "questions": []
}`;

export async function generateQuoteFromScope(
  scopeText: string
): Promise<QuoteGenerationResult> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `Please generate a quote for the following scope of work:\n\n${scopeText}`,
      },
    ],
    system: SYSTEM_PROMPT,
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Claude did not return valid JSON");
  }

  return JSON.parse(jsonMatch[0]) as QuoteGenerationResult;
}
```

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 4: Commit**

```bash
git add src/lib/claude.ts .env
git commit -m "feat: add Claude API service for quote generation"
```

Note: `.env` is in `.gitignore` — confirm before committing. If it is, only commit `src/lib/claude.ts`.

---

## Task 8: Quote API Routes

**Files:**
- Create: `src/app/api/quotes/route.ts`
- Create: `src/app/api/quotes/[id]/route.ts`
- Create: `src/app/api/quotes/generate/route.ts`
- Create: `src/app/api/proposals/[slug]/accept/route.ts`

**Step 1: Create quote list + create API**

```typescript
// src/app/api/quotes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateQuoteSlug } from "@/lib/slug";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quotes = await prisma.quote.findMany({
    include: { client: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(quotes);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { clientName, clientCompany, address, projectType, scopeText } = body;

  // Upsert client by name+company
  const client = await prisma.client.upsert({
    where: { id: body.clientId || "" },
    create: { name: clientName, company: clientCompany },
    update: { name: clientName, company: clientCompany },
  });

  const slug = generateQuoteSlug(clientName, address);

  const quote = await prisma.quote.create({
    data: {
      slug,
      title: `${address} — ${projectType}`,
      address,
      projectType,
      scopeText,
      clientId: client.id,
    },
    include: { client: true, sections: { include: { items: true } } },
  });

  return NextResponse.json(quote);
}
```

**Step 2: Create quote update API**

```typescript
// src/app/api/quotes/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quote = await prisma.quote.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      sections: {
        include: { items: { orderBy: { position: "asc" } } },
        orderBy: { position: "asc" },
      },
      acceptance: true,
    },
  });

  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(quote);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // Update quote metadata and percentages
  const quote = await prisma.quote.update({
    where: { id: params.id },
    data: {
      materialMarkupPct: body.materialMarkupPct,
      overheadPct: body.overheadPct,
      profitPct: body.profitPct,
      paymentTerms: body.paymentTerms,
      exclusions: body.exclusions,
      notes: body.notes,
      status: body.status,
      sentAt: body.status === "sent" ? new Date() : undefined,
    },
  });

  // Replace all sections and line items
  if (body.sections) {
    await prisma.lineItemSection.deleteMany({ where: { quoteId: params.id } });

    for (let si = 0; si < body.sections.length; si++) {
      const sec = body.sections[si];
      const section = await prisma.lineItemSection.create({
        data: { quoteId: params.id, title: sec.title, position: si },
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

  return NextResponse.json(quote);
}
```

**Step 3: Create quote generation API**

```typescript
// src/app/api/quotes/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { generateQuoteFromScope } from "@/lib/claude";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { scopeText } = await req.json();
  if (!scopeText) {
    return NextResponse.json({ error: "scopeText is required" }, { status: 400 });
  }

  const result = await generateQuoteFromScope(scopeText);
  return NextResponse.json(result);
}
```

**Step 4: Create acceptance API**

```typescript
// src/app/api/proposals/[slug]/accept/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const { signerName } = await req.json();

  if (!signerName) {
    return NextResponse.json({ error: "Signer name is required" }, { status: 400 });
  }

  const quote = await prisma.quote.findUnique({ where: { slug: params.slug } });
  if (!quote) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  if (quote.status === "accepted") {
    return NextResponse.json({ error: "Already accepted" }, { status: 409 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0] ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const acceptance = await prisma.acceptance.create({
    data: { quoteId: quote.id, signerName, ipAddress: ip },
  });

  await prisma.quote.update({
    where: { id: quote.id },
    data: { status: "accepted" },
  });

  return NextResponse.json(acceptance);
}
```

**Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add src/app/api/
git commit -m "feat: add quote and proposal API routes"
```

---

## Task 9: Quotes Dashboard Page

**Files:**
- Create: `src/app/internal/quotes/page.tsx`

**Step 1: Create quotes list page**

```typescript
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function QuotesPage() {
  const quotes = await prisma.quote.findMany({
    include: { client: true },
    orderBy: { createdAt: "desc" },
  });

  const statusColors: Record<string, string> = {
    draft: "text-text-muted border-border",
    sent: "text-accent border-accent",
    accepted: "text-green-400 border-green-400",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Quotes</h1>
        <Link
          href="/internal/quotes/new"
          className="bg-accent text-bg font-semibold px-5 py-2.5 rounded-sm text-sm hover:bg-accent/90 transition-colors"
        >
          New Quote
        </Link>
      </div>

      {quotes.length === 0 ? (
        <div className="border border-border rounded-sm p-12 text-center">
          <p className="text-text-muted mb-4">No quotes yet.</p>
          <Link href="/internal/quotes/new" className="text-accent text-sm hover:underline">
            Create your first quote
          </Link>
        </div>
      ) : (
        <div className="border border-border rounded-sm divide-y divide-border">
          {quotes.map((quote) => (
            <Link
              key={quote.id}
              href={`/internal/quotes/${quote.id}/edit`}
              className="flex items-center justify-between px-6 py-4 hover:bg-surface transition-colors"
            >
              <div>
                <p className="text-text-primary font-medium">{quote.title}</p>
                <p className="text-text-muted text-sm mt-0.5">
                  {quote.client.name}
                  {quote.client.company ? ` · ${quote.client.company}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-text-muted text-sm">
                  {new Date(quote.createdAt).toLocaleDateString()}
                </span>
                <span
                  className={`text-xs border px-2 py-0.5 rounded-full uppercase tracking-wide ${statusColors[quote.status]}`}
                >
                  {quote.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify in browser**

```bash
npm run dev
```

Visit `http://localhost:3000/internal/quotes` — should show empty state with "New Quote" button.

**Step 3: Commit**

```bash
git add src/app/internal/quotes/page.tsx
git commit -m "feat: add quotes dashboard page"
```

---

## Task 10: New Quote / Intake Page

**Files:**
- Create: `src/app/internal/quotes/new/page.tsx`

**Step 1: Create intake page**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PROJECT_TYPES = [
  "Office Buildout",
  "Retail / Restaurant",
  "Medical Suite",
  "Warehouse / Industrial",
  "Suite Renovation",
  "Light Maintenance / Repair",
  "Other",
];

const UNITS = ["ea", "SF", "LF", "LS", "hr"];

interface GeneratedItem {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  isMaterial: boolean;
}

interface GeneratedSection {
  title: string;
  items: GeneratedItem[];
}

export default function NewQuotePage() {
  const router = useRouter();
  const [step, setStep] = useState<"intake" | "questions" | "review">("intake");
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [sections, setSections] = useState<GeneratedSection[]>([]);

  const [form, setForm] = useState({
    clientName: "",
    clientCompany: "",
    address: "",
    projectType: "",
    scopeText: "",
  });

  const inputClass =
    "w-full bg-surface border border-border rounded-sm px-4 py-3 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent transition-colors";

  const handleGenerate = async () => {
    setLoading(true);
    const scopeWithAnswers =
      answers.length > 0
        ? `${form.scopeText}\n\nAdditional information:\n${questions.map((q, i) => `Q: ${q}\nA: ${answers[i] || "Not provided"}`).join("\n")}`
        : form.scopeText;

    const res = await fetch("/api/quotes/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scopeText: scopeWithAnswers }),
    });
    const data = await res.json();

    if (data.questions && data.questions.length > 0) {
      setQuestions(data.questions);
      setAnswers(new Array(data.questions.length).fill(""));
      setStep("questions");
    } else {
      setSections(data.sections);
      setStep("review");
    }
    setLoading(false);
  };

  const handleCreateQuote = async () => {
    setLoading(true);
    // Create quote
    const quoteRes = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form }),
    });
    const quote = await quoteRes.json();

    // Save sections
    await fetch(`/api/quotes/${quote.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        materialMarkupPct: 10,
        overheadPct: 10,
        profitPct: 10,
        sections,
      }),
    });

    router.push(`/internal/quotes/${quote.id}/edit`);
  };

  if (step === "questions") {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-text-primary mb-2">Clarifying Questions</h1>
        <p className="text-text-muted text-sm mb-8">
          Claude needs a few more details to price this accurately.
        </p>
        <div className="flex flex-col gap-6">
          {questions.map((q, i) => (
            <div key={i}>
              <label className="text-text-primary text-sm font-medium block mb-2">{q}</label>
              <input
                type="text"
                value={answers[i]}
                onChange={(e) => {
                  const next = [...answers];
                  next[i] = e.target.value;
                  setAnswers(next);
                }}
                className={inputClass}
                placeholder="Your answer..."
              />
            </div>
          ))}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-accent text-bg font-semibold py-3 rounded-sm text-sm hover:bg-accent/90 transition-colors disabled:opacity-60"
          >
            {loading ? "Generating..." : "Generate Quote"}
          </button>
        </div>
      </div>
    );
  }

  if (step === "review") {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-text-primary mb-2">Review Generated Quote</h1>
        <p className="text-text-muted text-sm mb-8">
          All fields are editable after saving.
        </p>
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
                    <span className="col-span-2 text-text-muted text-right">{item.quantity} {item.unit}</span>
                    <span className="col-span-2 text-text-muted text-right">${item.unitPrice}</span>
                    <span className="col-span-2 text-text-primary text-right font-medium">
                      ${(item.quantity * item.unitPrice).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setStep("intake")}
            className="border border-border text-text-primary px-5 py-2.5 rounded-sm text-sm hover:border-text-muted transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleCreateQuote}
            disabled={loading}
            className="bg-accent text-bg font-semibold px-5 py-2.5 rounded-sm text-sm hover:bg-accent/90 transition-colors disabled:opacity-60"
          >
            {loading ? "Creating..." : "Save & Edit Quote"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-text-primary mb-8">New Quote</h1>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <input name="clientName" type="text" placeholder="Client Name *" required
            value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })}
            className={inputClass} />
          <input name="clientCompany" type="text" placeholder="Company / Property"
            value={form.clientCompany} onChange={(e) => setForm({ ...form, clientCompany: e.target.value })}
            className={inputClass} />
        </div>
        <input name="address" type="text" placeholder="Job Site Address *" required
          value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
          className={inputClass} />
        <select name="projectType" value={form.projectType}
          onChange={(e) => setForm({ ...form, projectType: e.target.value })}
          className={`${inputClass} appearance-none`}>
          <option value="" disabled>Project Type *</option>
          {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <textarea name="scopeText" placeholder="Paste the scope of work here..." rows={10}
          value={form.scopeText} onChange={(e) => setForm({ ...form, scopeText: e.target.value })}
          className={`${inputClass} resize-none`} />
        <button onClick={handleGenerate}
          disabled={loading || !form.clientName || !form.address || !form.scopeText}
          className="bg-accent text-bg font-semibold py-3 rounded-sm text-sm hover:bg-accent/90 transition-colors disabled:opacity-60">
          {loading ? "Analyzing scope..." : "Generate Quote with AI"}
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Test the intake flow**

```bash
npm run dev
```

Visit `http://localhost:3000/internal/quotes/new`. Fill in the form and paste a scope. Click Generate — should either show questions or the review step.

**Step 3: Commit**

```bash
git add src/app/internal/quotes/new/page.tsx
git commit -m "feat: add new quote intake page with AI generation and clarifying questions"
```

---

## Task 11: Quote Editor Page

**Files:**
- Create: `src/app/internal/quotes/[id]/edit/page.tsx`
- Create: `src/components/internal/QuoteEditor.tsx`

**Step 1: Create QuoteEditor client component**

```typescript
// src/components/internal/QuoteEditor.tsx
"use client";

import { useState, useCallback } from "react";
import { calculateQuoteTotals } from "@/lib/pricing";

const UNITS = ["ea", "SF", "LF", "LS", "hr"];

interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  isMaterial: boolean;
}

interface Section {
  id?: string;
  title: string;
  items: LineItem[];
}

interface Quote {
  id: string;
  slug: string;
  title: string;
  address: string;
  projectType: string;
  status: string;
  materialMarkupPct: number;
  overheadPct: number;
  profitPct: number;
  paymentTerms: string;
  exclusions: string;
  notes: string;
  client: { name: string; company: string };
  sections: Section[];
}

export default function QuoteEditor({ quote: initial }: { quote: Quote }) {
  const [quote, setQuote] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const allItems = quote.sections.flatMap((s) => s.items);
  const totals = calculateQuoteTotals(
    allItems,
    quote.materialMarkupPct,
    quote.overheadPct,
    quote.profitPct
  );

  const updateItem = (si: number, ii: number, field: keyof LineItem, value: string | number | boolean) => {
    setQuote((q) => {
      const sections = q.sections.map((s, sIdx) =>
        sIdx !== si ? s : {
          ...s,
          items: s.items.map((item, iIdx) =>
            iIdx !== ii ? item : { ...item, [field]: value }
          ),
        }
      );
      return { ...q, sections };
    });
  };

  const addItem = (si: number) => {
    setQuote((q) => ({
      ...q,
      sections: q.sections.map((s, sIdx) =>
        sIdx !== si ? s : {
          ...s,
          items: [...s.items, { description: "", quantity: 1, unit: "ea", unitPrice: 0, isMaterial: false }],
        }
      ),
    }));
  };

  const removeItem = (si: number, ii: number) => {
    setQuote((q) => ({
      ...q,
      sections: q.sections.map((s, sIdx) =>
        sIdx !== si ? s : { ...s, items: s.items.filter((_, iIdx) => iIdx !== ii) }
      ),
    }));
  };

  const addSection = () => {
    setQuote((q) => ({
      ...q,
      sections: [...q.sections, { title: "New Section", items: [] }],
    }));
  };

  const save = useCallback(async () => {
    setSaving(true);
    await fetch(`/api/quotes/${quote.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(quote),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [quote]);

  const markSent = async () => {
    const link = `${window.location.origin}/proposals/${quote.slug}`;
    await navigator.clipboard.writeText(link);
    await fetch(`/api/quotes/${quote.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...quote, status: "sent" }),
    });
    setQuote((q) => ({ ...q, status: "sent" }));
    alert(`Proposal link copied to clipboard:\n${link}`);
  };

  const inputClass = "bg-transparent border border-transparent hover:border-border focus:border-accent rounded px-2 py-1 text-sm text-text-primary focus:outline-none transition-colors w-full";

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
      {/* Line items — takes 3 cols */}
      <div className="xl:col-span-3">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-text-primary">{quote.title}</h1>
            <p className="text-text-muted text-sm">{quote.client.name}{quote.client.company ? ` · ${quote.client.company}` : ""}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={save} disabled={saving}
              className="border border-border text-text-primary px-4 py-2 rounded-sm text-sm hover:border-text-muted transition-colors disabled:opacity-60">
              {saving ? "Saving..." : saved ? "Saved" : "Save"}
            </button>
            <a href={`/proposals/${quote.slug}`} target="_blank"
              className="border border-border text-text-primary px-4 py-2 rounded-sm text-sm hover:border-text-muted transition-colors">
              Preview
            </a>
            <button onClick={markSent}
              className="bg-accent text-bg font-semibold px-4 py-2 rounded-sm text-sm hover:bg-accent/90 transition-colors">
              Send to Client
            </button>
          </div>
        </div>

        {/* Section headers */}
        <div className="grid grid-cols-12 gap-2 px-3 mb-1 text-xs text-text-muted uppercase tracking-widest">
          <span className="col-span-5">Description</span>
          <span className="col-span-1 text-right">Qty</span>
          <span className="col-span-1">Unit</span>
          <span className="col-span-2 text-right">Unit Price</span>
          <span className="col-span-2 text-right">Total</span>
          <span className="col-span-1" />
        </div>

        <div className="flex flex-col gap-4">
          {quote.sections.map((sec, si) => (
            <div key={si} className="border border-border rounded-sm">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface">
                <input
                  value={sec.title}
                  onChange={(e) => setQuote((q) => ({
                    ...q,
                    sections: q.sections.map((s, i) => i === si ? { ...s, title: e.target.value } : s),
                  }))}
                  className="bg-transparent text-text-primary font-medium text-sm focus:outline-none flex-1"
                />
              </div>
              <div className="divide-y divide-border">
                {sec.items.map((item, ii) => (
                  <div key={ii} className="grid grid-cols-12 gap-2 px-3 py-2 items-center group">
                    <div className="col-span-5">
                      <input value={item.description}
                        onChange={(e) => updateItem(si, ii, "description", e.target.value)}
                        className={inputClass} placeholder="Description" />
                    </div>
                    <div className="col-span-1">
                      <input type="number" value={item.quantity}
                        onChange={(e) => updateItem(si, ii, "quantity", parseFloat(e.target.value) || 0)}
                        className={`${inputClass} text-right`} />
                    </div>
                    <div className="col-span-1">
                      <select value={item.unit}
                        onChange={(e) => updateItem(si, ii, "unit", e.target.value)}
                        className="bg-surface border border-border rounded px-1 py-1 text-sm text-text-primary focus:outline-none focus:border-accent w-full">
                        {UNITS.map((u) => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input type="number" value={item.unitPrice}
                        onChange={(e) => updateItem(si, ii, "unitPrice", parseFloat(e.target.value) || 0)}
                        className={`${inputClass} text-right`} />
                    </div>
                    <div className="col-span-2 text-right text-sm text-text-primary font-medium pr-2">
                      ${(item.quantity * item.unitPrice).toFixed(2)}
                    </div>
                    <div className="col-span-1 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => removeItem(si, ii)}
                        className="text-text-muted hover:text-red-400 text-xs px-1">✕</button>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => addItem(si)}
                className="w-full py-2 text-xs text-text-muted hover:text-accent transition-colors border-t border-border">
                + Add Line Item
              </button>
            </div>
          ))}
          <button onClick={addSection}
            className="border border-dashed border-border rounded-sm py-3 text-sm text-text-muted hover:border-accent hover:text-accent transition-colors">
            + Add Section
          </button>
        </div>
      </div>

      {/* Summary panel — 1 col */}
      <div className="xl:col-span-1">
        <div className="border border-border rounded-sm p-4 sticky top-6">
          <h2 className="text-text-primary font-semibold text-sm mb-4">Quote Summary</h2>

          <div className="flex flex-col gap-3 text-sm mb-4">
            <div className="flex justify-between">
              <span className="text-text-muted">Subtotal</span>
              <span className="text-text-primary">${totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Materials markup</span>
              <div className="flex items-center gap-1">
                <input type="number" value={quote.materialMarkupPct}
                  onChange={(e) => setQuote((q) => ({ ...q, materialMarkupPct: parseFloat(e.target.value) || 0 }))}
                  className="w-12 bg-surface border border-border rounded px-1 py-0.5 text-xs text-text-primary text-right focus:outline-none focus:border-accent" />
                <span className="text-text-muted text-xs">%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Overhead</span>
              <div className="flex items-center gap-1">
                <input type="number" value={quote.overheadPct}
                  onChange={(e) => setQuote((q) => ({ ...q, overheadPct: parseFloat(e.target.value) || 0 }))}
                  className="w-12 bg-surface border border-border rounded px-1 py-0.5 text-xs text-text-primary text-right focus:outline-none focus:border-accent" />
                <span className="text-text-muted text-xs">%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Profit</span>
              <div className="flex items-center gap-1">
                <input type="number" value={quote.profitPct}
                  onChange={(e) => setQuote((q) => ({ ...q, profitPct: parseFloat(e.target.value) || 0 }))}
                  className="w-12 bg-surface border border-border rounded px-1 py-0.5 text-xs text-text-primary text-right focus:outline-none focus:border-accent" />
                <span className="text-text-muted text-xs">%</span>
              </div>
            </div>
            <div className="border-t border-border pt-3 flex justify-between">
              <span className="text-text-primary font-semibold">Total</span>
              <span className="text-accent font-bold text-lg">${totals.total.toFixed(2)}</span>
            </div>
          </div>

          <div className="border-t border-border pt-4 flex flex-col gap-2">
            <span className={`text-xs border px-2 py-1 rounded-full text-center uppercase tracking-wide ${
              quote.status === "accepted" ? "text-green-400 border-green-400" :
              quote.status === "sent" ? "text-accent border-accent" :
              "text-text-muted border-border"
            }`}>
              {quote.status}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Create the edit page (server component)**

```typescript
// src/app/internal/quotes/[id]/edit/page.tsx
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import QuoteEditor from "@/components/internal/QuoteEditor";

export default async function EditQuotePage({ params }: { params: { id: string } }) {
  const quote = await prisma.quote.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      sections: {
        include: { items: { orderBy: { position: "asc" } } },
        orderBy: { position: "asc" },
      },
      acceptance: true,
    },
  });

  if (!quote) notFound();

  return <QuoteEditor quote={quote as any} />;
}
```

**Step 3: Test the editor**

```bash
npm run dev
```

Create a quote through the intake page. You should land on the editor. Verify:
- [ ] Line items are editable inline
- [ ] Totals update live as you change values
- [ ] Percentage fields in summary panel update totals
- [ ] Save button works
- [ ] Preview link opens `/proposals/[slug]`

**Step 4: Commit**

```bash
git add src/app/internal/quotes/[id]/ src/components/internal/QuoteEditor.tsx
git commit -m "feat: add quote editor with live pricing and section management"
```

---

## Task 12: Proposal Output Page

**Files:**
- Create: `src/app/proposals/[slug]/page.tsx`
- Create: `src/app/proposals/[slug]/AcceptanceBlock.tsx`

**Step 1: Create acceptance block (client component)**

```typescript
// src/app/proposals/[slug]/AcceptanceBlock.tsx
"use client";

import { useState } from "react";

export default function AcceptanceBlock({ slug, accepted, signerName, acceptedAt }: {
  slug: string;
  accepted: boolean;
  signerName?: string;
  acceptedAt?: string;
}) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done">(accepted ? "done" : "idle");
  const [finalName, setFinalName] = useState(signerName || "");
  const [finalDate, setFinalDate] = useState(acceptedAt || "");

  const handleAccept = async () => {
    if (!name.trim()) return;
    setStatus("loading");
    const res = await fetch(`/api/proposals/${slug}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signerName: name }),
    });
    const data = await res.json();
    setFinalName(name);
    setFinalDate(new Date(data.acceptedAt).toLocaleString());
    setStatus("done");
  };

  if (status === "done") {
    return (
      <div className="border border-green-800 bg-green-950/30 rounded-sm p-6 print:border-border print:bg-transparent">
        <p className="text-green-400 font-semibold mb-1">Proposal Accepted</p>
        <p className="text-text-muted text-sm">
          Accepted by <span className="text-text-primary">{finalName}</span>
          {finalDate && <> on {finalDate}</>}
        </p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-sm p-6 print:hidden">
      <h3 className="text-text-primary font-semibold mb-1">Acceptance of Proposal</h3>
      <p className="text-text-muted text-sm mb-4">
        By entering your name and clicking Accept, you authorize Building NV to furnish all materials and labor required to complete the work described above, and agree to the terms and payment schedule.
      </p>
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Your full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 bg-surface border border-border rounded-sm px-4 py-3 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent"
        />
        <button
          onClick={handleAccept}
          disabled={!name.trim() || status === "loading"}
          className="bg-accent text-bg font-semibold px-6 py-3 rounded-sm text-sm hover:bg-accent/90 transition-colors disabled:opacity-60 whitespace-nowrap"
        >
          {status === "loading" ? "Accepting..." : "I Accept This Proposal"}
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Create proposal page (server component)**

```typescript
// src/app/proposals/[slug]/page.tsx
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { calculateQuoteTotals } from "@/lib/pricing";
import AcceptanceBlock from "./AcceptanceBlock";

export default async function ProposalPage({ params }: { params: { slug: string } }) {
  const quote = await prisma.quote.findUnique({
    where: { slug: params.slug },
    include: {
      client: true,
      sections: {
        include: { items: { orderBy: { position: "asc" } } },
        orderBy: { position: "asc" },
      },
      acceptance: true,
    },
  });

  if (!quote) notFound();

  const allItems = quote.sections.flatMap((s) =>
    s.items.map((i) => ({ unitPrice: i.unitPrice, quantity: i.quantity, isMaterial: i.isMaterial }))
  );
  const totals = calculateQuoteTotals(allItems, quote.materialMarkupPct, quote.overheadPct, quote.profitPct);

  return (
    <div className="min-h-screen bg-white text-gray-900 print:bg-white">
      <div className="max-w-3xl mx-auto px-8 py-12 print:px-0 print:py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8 pb-8 border-b border-gray-200">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Building NV</h1>
            <p className="text-gray-500 text-sm">Commercial Tenant Improvement · Reno, Nevada</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-gray-900">PROPOSAL</p>
            <p className="text-gray-500 text-sm">
              {new Date(quote.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        </div>

        {/* Client + Job Site */}
        <div className="grid grid-cols-2 gap-8 mb-8 pb-8 border-b border-gray-200">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Client</p>
            <p className="font-semibold text-gray-900">{quote.client.name}</p>
            {quote.client.company && <p className="text-gray-600 text-sm">{quote.client.company}</p>}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Job Site</p>
            <p className="font-semibold text-gray-900">{quote.address}</p>
            <p className="text-gray-600 text-sm">{quote.projectType}</p>
          </div>
        </div>

        <p className="text-gray-700 mb-8">
          Thank you for the opportunity to provide this proposal. Building NV proposes to perform the following work as outlined below.
        </p>

        {/* Line Items */}
        {quote.sections.map((sec) => (
          <div key={sec.id} className="mb-6">
            <h2 className="font-bold text-gray-900 underline mb-3">{sec.title}:</h2>
            <div className="space-y-1">
              {sec.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-700 flex-1 pr-4">— {item.description}</span>
                  <span className="text-gray-900 font-medium whitespace-nowrap">
                    ${(item.quantity * item.unitPrice).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Totals */}
        <div className="border-t border-gray-200 pt-6 mt-6 mb-8">
          {totals.materialsMarkupAmount > 0 && (
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Materials Markup ({quote.materialMarkupPct}%)</span>
              <span>${totals.materialsMarkupAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Overhead ({quote.overheadPct}%)</span>
            <span>${totals.overheadAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600 mb-4">
            <span>Profit ({quote.profitPct}%)</span>
            <span>${totals.profitAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg text-gray-900 border-t border-gray-300 pt-3">
            <span>Total Cost:</span>
            <span>${totals.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Payment Terms */}
        <div className="mb-6">
          <h3 className="font-bold text-gray-900 underline mb-2">Note:</h3>
          <p className="text-sm text-gray-700">{quote.paymentTerms}</p>
        </div>

        {/* Exclusions */}
        <div className="mb-6">
          <h3 className="font-bold text-gray-900 underline mb-2">Exclusions</h3>
          <div className="border border-gray-300 p-3 text-sm text-gray-700">
            {quote.exclusions}
          </div>
        </div>

        {/* Terms */}
        <div className="mb-10 text-xs text-gray-600 space-y-2">
          <h3 className="font-bold text-gray-900 text-sm underline mb-2">Terms & Conditions:</h3>
          <p><strong>A.</strong> Interest of 2% per month will be added on all overdue accounts beginning on the day of delinquency.</p>
          <p><strong>B.</strong> Any alteration or deviation from the above specifications requiring extra cost will become an extra charge via written change order.</p>
          <p><strong>C.</strong> All agreements contingent upon strikes, accidents, or delays beyond our control including material availability and pricing changes.</p>
          <p><strong>D.</strong> Warranty void by earthquake, tornado, or other act of God, or by non-payment. Warranty coverage begins at time of final payment.</p>
          <p><strong>E.</strong> This proposal does not include labor or material for unforeseen conditions. Additional repair fees will be added via change order.</p>
          <p><strong>F.</strong> Payment due within thirty days of date of invoice (net 30).</p>
        </div>

        {/* Acceptance */}
        <AcceptanceBlock
          slug={quote.slug}
          accepted={!!quote.acceptance}
          signerName={quote.acceptance?.signerName}
          acceptedAt={quote.acceptance?.acceptedAt?.toString()}
        />

      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
```

**Step 3: Test the full flow**

```bash
npm run dev
```

1. Create a quote via `/internal/quotes/new`
2. Edit it at `/internal/quotes/[id]/edit`
3. Click Preview — should open `/proposals/[slug]`
4. Verify proposal renders correctly
5. Enter a name and click Accept — should show accepted state
6. Print the page (Cmd+P) — verify clean output

**Step 4: Run full type check and build**

```bash
npx tsc --noEmit
npm run build
```

Expected: no errors.

**Step 5: Commit**

```bash
git add src/app/proposals/
git commit -m "feat: add proposal output page with acceptance flow and print styles"
```

---

## Task 13: Deploy to Vercel

**Step 1: Set environment variables in Vercel**

```bash
vercel env add ANTHROPIC_API_KEY
vercel env add NEXTAUTH_SECRET
vercel env add NEXTAUTH_URL
vercel env add INTERNAL_USERNAME
vercel env add INTERNAL_PASSWORD
vercel env add DATABASE_URL
```

For `DATABASE_URL` on Vercel with SQLite: use `file:./dev.db` locally. For production, switch to Vercel Postgres (free tier) or PlanetScale.

**Step 2: Add Vercel Postgres for production (recommended)**

In Vercel dashboard → Storage → Create Postgres database → connect to project. This auto-adds `DATABASE_URL` and `POSTGRES_*` env vars.

Update `prisma/schema.prisma` datasource for production:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

Run migration:
```bash
npx prisma migrate deploy
```

**Step 3: Deploy**

```bash
vercel --prod
```

**Step 4: Verify**

Visit the production URL. Test the full flow: login → new quote → generate → edit → preview → accept.

**Step 5: Final commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: configure Prisma for Vercel Postgres production"
```

---

## Quick Reference

| Command | Purpose |
|---|---|
| `npm run dev` | Local dev server |
| `npm test` | Run Jest tests |
| `npx tsc --noEmit` | Type check |
| `npm run build` | Production build |
| `npx prisma studio` | Browse database in browser |
| `npx prisma migrate dev --name <name>` | Create new migration |
| `vercel --prod` | Deploy to production |

## Key File Locations

| File | Purpose |
|---|---|
| `src/lib/pricing.ts` | Quote total calculations |
| `src/lib/claude.ts` | Claude API service + system prompt |
| `src/lib/auth.ts` | NextAuth config |
| `src/lib/prisma.ts` | Prisma client singleton |
| `prisma/schema.prisma` | Database schema |
| `src/app/(internal)/` | Protected internal routes |
| `src/app/proposals/[slug]/` | Public proposal page |
| `src/app/api/quotes/` | Quote CRUD API |
| `src/app/api/proposals/[slug]/accept/` | Acceptance API |

## Important: Before Going Live

1. Replace placeholder phone number in Contact section
2. Set strong `INTERNAL_PASSWORD` in Vercel env vars
3. Update `NEXTAUTH_URL` to production domain
4. Swap SQLite for Vercel Postgres
5. Add real Building NV T&Cs (have attorney review)
