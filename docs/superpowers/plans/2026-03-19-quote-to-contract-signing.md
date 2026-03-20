# Quote → Contract → Change Order: Document Signing Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a complete document signing lifecycle to the Building NV app — quotes get real signatures, signed quotes auto-assemble into a contract with an MSA wrapper, and change orders follow the same flow — all triggerable from the internal UI or via Claude Code MCP tools.

**Architecture:** All document logic lives inside the existing Next.js app. A `src/lib/docs/` module handles HTML rendering, PDF generation (Puppeteer), and email delivery (Resend) — ported from `centered-os/src/server/`. The `src/` prefix is required because the app's tsconfig alias `@/*` resolves to `./src/*` — all `lib/` files must live inside `src/`. Public signing pages live at `/proposals/[token]` (already exists — will be upgraded), `/contracts/[token]`, and `/change-orders/[token]`. Token-based, no auth required on signing pages. Internal UI triggers flows from the quote detail page. Prisma schema gets extended with signing fields, a `Contract` model, and a `ChangeOrder` model.

**Tech Stack:** Next.js 16 App Router, Prisma + SQLite, Puppeteer (Node.js, server-only), Resend, signature_pad.min.js (already in `centered-os/src/sow/`)

---

## Source Files to Port from centered-os

Before starting, copy these files as starting points — they will be adapted, not used as-is:

- `centered-os/src/server/pdf.ts` → base for `src/lib/docs/pdf.ts`
- `centered-os/src/server/email.ts` → base for `src/lib/docs/email.ts`
- `centered-os/src/server/routes/sign.ts` → reference for signature injection logic
- `centered-os/src/sow/signature_pad.min.js` → copy to `public/signature_pad.min.js`

---

## Document Status Machine

```
Quote:   draft → sent → quote_signed
Contract: draft → contract_sent → executed
ChangeOrder: draft → co_sent → executed
```

When Contract reaches `executed`, the linked Project's stage auto-updates to `contract_signed`.

---

## File Map

### New files to create:

```
src/lib/docs/
  pdf.ts                          — Puppeteer: renders HTML → signed PDF (ported from centered-os)
  email.ts                        — Resend: signing link + signed PDF delivery (ported from centered-os)
  quote-template.ts               — Renders Quote (with all relations) → self-contained HTML string
  msa-template.ts                 — MSA boilerplate template — parameterized, returns HTML string
  change-order-template.ts        — Change order template — scope delta + price delta, returns HTML string

public/
  signature_pad.min.js            — Copied from centered-os/src/sow/signature_pad.min.js

src/app/
  api/quotes/[id]/send/
    route.ts                      — POST: generate token, email client signing link
  api/sign/quote/[token]/
    route.ts                      — GET: serve signing page; POST: capture sig, generate PDF, send email
  api/quotes/[id]/convert-to-contract/
    route.ts                      — POST: assemble MSA + Exhibit A, create Contract record
  api/contracts/
    route.ts                      — GET list (by project)
  api/contracts/[id]/
    route.ts                      — GET single contract
  api/contracts/[id]/html/
    route.ts                      — GET: serve assembled contract HTML (public, used by iframe)
  api/contracts/[id]/send/
    route.ts                      — POST: generate token, email client signing link
  api/sign/contract/[token]/
    route.ts                      — GET: serve signing page; POST: capture sig, generate PDF, send email
  api/change-orders/
    route.ts                      — POST: create change order linked to contract
  api/change-orders/[id]/send/
    route.ts                      — POST: generate token, email client signing link
  api/sign/change-order/[token]/
    route.ts                      — GET: serve signing page; POST: capture sig, generate PDF, send email

  contracts/[token]/
    page.tsx                      — Public contract signing page (SSR, no auth)
  change-orders/[token]/
    page.tsx                      — Public change order signing page (SSR, no auth)

  proposals/[slug]/
    AcceptanceBlock.tsx           — MODIFY: add signature pad, wire to new sign/quote route
```

### Files to modify:

```
prisma/schema.prisma              — Extend Quote, extend Acceptance, add Contract + ChangeOrder
src/app/internal/quotes/[id]/edit/page.tsx  — Add "Send for Signature" button + status badge
src/app/proposals/[slug]/page.tsx — Switch from slug-based to token-based lookup (or keep both)
```

---

## Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Run: `npx prisma migrate dev`

- [ ] **Step 1: Extend Quote model**

Add to `Quote` in `schema.prisma`:

```prisma
signingToken      String?   @unique
signingTokenExpiresAt DateTime?
signedAt          DateTime?
signedPdfPath     String?
// status extended: draft | sent | quote_signed
```

- [ ] **Step 2: Extend Acceptance model**

Add to `Acceptance` in `schema.prisma`:

```prisma
signaturePngPath  String?   // path to saved signature PNG file
```

- [ ] **Step 3: Add Contract model**

```prisma
model Contract {
  id              String    @id @default(cuid())
  quoteId         String    @unique
  quote           Quote     @relation(fields: [quoteId], references: [id])
  projectId       String?
  project         Project?  @relation(fields: [projectId], references: [id])
  status          String    @default("draft") // draft | contract_sent | executed
  htmlPath        String?   // path to assembled MSA+Exhibit A HTML
  contractAmount  Float?    // tracks total as COs are executed (set on creation from quote total)
  signingToken    String?   @unique
  signingTokenExpiresAt DateTime?
  signerName      String?
  signedAt        DateTime?
  signedPdfPath   String?
  sentAt          DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  changeOrders    ChangeOrder[]
}
```

- [ ] **Step 4: Add ChangeOrder model**

```prisma
model ChangeOrder {
  id              String    @id @default(cuid())
  contractId      String
  contract        Contract  @relation(fields: [contractId], references: [id])
  number          Int       // sequential per contract: 1, 2, 3...
  title           String
  scopeDelta      String    // description of scope change
  priceDelta      Float     // positive = addition, negative = credit
  status          String    @default("draft") // draft | co_sent | executed
  htmlPath        String?
  signingToken    String?   @unique
  signingTokenExpiresAt DateTime?
  signerName      String?
  signedAt        DateTime?
  signedPdfPath   String?
  sentAt          DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

- [ ] **Step 5: Add back-relation on Project for Contract**

Add to `Project` model:

```prisma
contracts         Contract[]
```

- [ ] **Step 6: Run migration**

```bash
cd projects/bldn-inc/building-nv
npx prisma migrate dev --name add-signing-contract-changeorder
```

Expected: migration created and applied, `src/generated/prisma` regenerated.

- [ ] **Step 7: Verify migration**

```bash
npx prisma studio
```

Confirm `Quote`, `Contract`, `ChangeOrder` tables exist with new columns.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add signing tokens, Contract, and ChangeOrder to schema"
```

---

## Task 2: Copy Signing Assets + Install Dependencies

**Files:**
- Create: `public/signature_pad.min.js`
- Modify: `package.json`

- [ ] **Step 1: Copy signature pad**

```bash
cp ../../../src/sow/signature_pad.min.js public/signature_pad.min.js
```

Verify: `public/signature_pad.min.js` exists and is non-empty.

- [ ] **Step 2: Add `docs-storage/` to `.gitignore`**

```bash
echo "docs-storage/" >> .gitignore
```

Verify: `cat .gitignore | grep docs-storage`

This prevents PDFs and signature PNGs from being committed.

- [ ] **Step 3: Install Puppeteer**

```bash
npm install puppeteer
```

Puppeteer downloads Chromium automatically. Verify `node_modules/puppeteer` exists.

For production on Fly.io, use `puppeteer-core` + a system Chromium binary instead (set `PUPPETEER_EXECUTABLE_PATH` to the Chromium path). For development, `puppeteer` with bundled Chromium is fine.

Note: Puppeteer is a server-only dep. It must never be imported in client components. If Next.js complains about bundling it, add to `next.config.ts`:

```ts
// next.config.ts
const nextConfig = {
  serverExternalPackages: ['puppeteer'],
};
```

- [ ] **Step 6: Install signature_pad npm package**

```bash
npm install signature_pad
```

This replaces the public JS file approach. The npm package is used in `AcceptanceBlock.tsx` (see Task 7). The `public/signature_pad.min.js` copy is no longer needed but harmless to keep.

- [ ] **Step 7: Verify Resend is already installed**

```bash
cat package.json | grep resend
```

If not present: `npm install resend`

- [ ] **Step 4: Add env vars to .env.local**

```bash
# .env.local — add these lines
RESEND_API_KEY="re_..."
RESEND_FROM_NAME="Building NV"
RESEND_FROM_EMAIL="estimates@buildingnv.com"
RESEND_BCC_EMAIL="cody@buildingnv.com"
DOCS_DIR="./docs-storage"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
```

`DOCS_DIR` is where PDFs and signature PNGs are stored. In production, this will be a Fly.io mounted volume path.

- [ ] **Step 5: Commit**

```bash
git add public/signature_pad.min.js package.json package-lock.json next.config.ts
git commit -m "feat: add signature_pad, puppeteer, docs env config"
```

---

## Task 3: Document Generation Library

**Files:**
- Create: `lib/docs/pdf.ts`
- Create: `lib/docs/email.ts`

These are direct ports of `centered-os/src/server/pdf.ts` and `centered-os/src/server/email.ts` with minor adaptations (no file-path-based HTML input — accept HTML string directly; use env vars from `.env.local`).

- [ ] **Step 1: Write failing test for PDF generation**

```ts
// src/__tests__/docs/pdf.test.ts
import { generateSignedPDF } from '@/lib/docs/pdf';
import { existsSync, unlinkSync } from 'fs';
import path from 'path';

const OUT = path.join(process.cwd(), 'docs-storage', 'test-signed.pdf');

afterAll(() => { if (existsSync(OUT)) unlinkSync(OUT); });

it('generates a PDF file from HTML + signature', async () => {
  const html = '<html><body><h1>Test Document</h1></body></html>';
  const fakeSig = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  await generateSignedPDF(html, OUT, fakeSig);
  expect(existsSync(OUT)).toBe(true);
}, 30000); // Puppeteer can be slow
```

- [ ] **Step 2: Run test, verify fail**

```bash
npm test -- --testPathPattern=docs/pdf
```

Expected: FAIL — `Cannot find module '@/lib/docs/pdf'`

- [ ] **Step 3: Create `lib/docs/pdf.ts`**

```ts
// src/lib/docs/pdf.ts
// Server-only. Never import in client components.
import puppeteer from 'puppeteer';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

export async function generateSignedPDF(
  documentHtml: string,
  outputPath: string,
  signaturePng: string // data URL: "data:image/png;base64,..."
): Promise<void> {
  const signedAt = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const signatureBlock = `
<div style="margin-top:60px;padding:24px;border:1px solid #ccc;border-radius:4px;">
  <p style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;">Electronic Signature</p>
  <p style="color:#555;font-size:0.85em;">Signed on ${signedAt}</p>
  <img src="${signaturePng}" style="max-width:360px;border:1px solid #ccc;display:block;margin-top:8px;" alt="Signature" />
</div>`;

  const signedHtml = documentHtml.replace('</body>', `${signatureBlock}\n</body>`);

  mkdirSync(dirname(outputPath), { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(signedHtml, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: outputPath,
      format: 'Letter',
      margin: { top: '1in', bottom: '1in', left: '1in', right: '1in' },
    });
  } finally {
    await browser.close();
  }
}
```

- [ ] **Step 4: Run test, verify pass**

```bash
npm test -- --testPathPattern=docs/pdf
```

Expected: PASS. Verify `docs-storage/test-signed.pdf` was created.

- [ ] **Step 5: Write failing test for email**

```ts
// src/__tests__/docs/email.test.ts
import { buildSigningLinkEmail, buildSignedPDFEmail } from '@/lib/docs/email';

it('buildSigningLinkEmail returns html with signing url', () => {
  const html = buildSigningLinkEmail({
    recipientFirstName: 'John',
    projectTitle: 'Office TI — 500 Liberty St',
    signingUrl: 'https://buildingnv.com/proposals/abc123',
    senderName: 'Cody McDannald',
  });
  expect(html).toContain('https://buildingnv.com/proposals/abc123');
  expect(html).toContain('John');
  expect(html).toContain('Office TI — 500 Liberty St');
});

it('buildSignedPDFEmail returns html with project title', () => {
  const html = buildSignedPDFEmail({
    projectTitle: 'Office TI — 500 Liberty St',
    senderName: 'Cody McDannald',
  });
  expect(html).toContain('Office TI — 500 Liberty St');
});
```

- [ ] **Step 6: Run test, verify fail**

```bash
npm test -- --testPathPattern=docs/email
```

Expected: FAIL — module not found.

- [ ] **Step 7: Create `lib/docs/email.ts`**

```ts
// src/lib/docs/email.ts
import { Resend } from 'resend';
import { readFileSync } from 'fs';

function resend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not set');
  return new Resend(key);
}

const FROM = () =>
  `${process.env.RESEND_FROM_NAME ?? 'Building NV'} <${process.env.RESEND_FROM_EMAIL ?? 'estimates@buildingnv.com'}>`;
const BCC = () => process.env.RESEND_BCC_EMAIL ?? '';

export function buildSigningLinkEmail(opts: {
  recipientFirstName: string;
  projectTitle: string;
  signingUrl: string;
  senderName: string;
  docLabel?: string; // "Proposal" | "Contract" | "Change Order"
}): string {
  const label = opts.docLabel ?? 'Proposal';
  return `
<p>Hi ${opts.recipientFirstName},</p>
<p>Please review and sign the ${label} for <strong>${opts.projectTitle}</strong>:</p>
<p>
  <a href="${opts.signingUrl}"
     style="background:#111110;color:white;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;font-family:sans-serif;">
    Review &amp; Sign ${label}
  </a>
</p>
<p style="color:#666;font-size:13px;">This link expires in 30 days. Reply with any questions.</p>
<p>— ${opts.senderName}<br>Building NV</p>`;
}

export function buildSignedPDFEmail(opts: {
  projectTitle: string;
  senderName: string;
  docLabel?: string;
}): string {
  const label = opts.docLabel ?? 'Proposal';
  return `
<p>Please find your signed ${label} attached for <strong>${opts.projectTitle}</strong>.</p>
<p>We look forward to working with you.</p>
<p>— ${opts.senderName}<br>Building NV</p>`;
}

export async function sendSigningLink(opts: {
  toEmail: string;
  toName: string;
  projectTitle: string;
  signingUrl: string;
  docLabel?: string;
  subject?: string;
}): Promise<void> {
  const label = opts.docLabel ?? 'Proposal';
  const firstName = opts.toName.split(' ')[0] ?? opts.toName;
  const r = resend();
  await r.emails.send({
    from: FROM(),
    to: [opts.toEmail],
    bcc: BCC() ? [BCC()] : [],
    subject: opts.subject ?? `${label} — ${opts.projectTitle}`,
    html: buildSigningLinkEmail({
      recipientFirstName: firstName,
      projectTitle: opts.projectTitle,
      signingUrl: opts.signingUrl,
      senderName: process.env.RESEND_FROM_NAME ?? 'Building NV',
      docLabel: label,
    }),
  });
}

export async function sendSignedPDF(opts: {
  toEmail: string;
  toName: string;
  projectTitle: string;
  signedPdfPath: string;
  docLabel?: string;
  subject?: string;
}): Promise<void> {
  const label = opts.docLabel ?? 'Proposal';
  const r = resend();
  await r.emails.send({
    from: FROM(),
    to: [opts.toEmail],
    bcc: BCC() ? [BCC()] : [],
    subject: opts.subject ?? `Signed ${label} — ${opts.projectTitle}`,
    html: buildSignedPDFEmail({
      projectTitle: opts.projectTitle,
      senderName: process.env.RESEND_FROM_NAME ?? 'Building NV',
      docLabel: label,
    }),
    attachments: [
      {
        filename: `${opts.projectTitle} — Signed ${label}.pdf`,
        content: readFileSync(opts.signedPdfPath).toString('base64'),
      },
    ],
  });
}
```

- [ ] **Step 8: Run tests, verify pass**

```bash
npm test -- --testPathPattern=docs/email
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/docs/pdf.ts src/lib/docs/email.ts src/__tests__/docs/
git commit -m "feat: add docs pdf and email lib (ported from centered-os)"
```

---

## Task 4: Quote HTML Template

**Files:**
- Create: `lib/docs/quote-template.ts`
- Test: `src/__tests__/docs/quote-template.test.ts`

This renders a quote (with all Prisma relations populated) into a self-contained HTML string suitable for Puppeteer + the signing page. Mirrors the visual structure of the existing `proposals/[slug]/page.tsx` but as a server-side HTML string (no React).

- [ ] **Step 1: Write failing test**

```ts
// src/__tests__/docs/quote-template.test.ts
import { renderQuoteHtml } from '@/lib/docs/quote-template';

const mockQuote = {
  id: 'q1', slug: 'test-slug', title: 'Office TI',
  address: '123 Main St, Reno NV',
  projectType: 'Tenant Improvement',
  materialMarkupPct: 10, overheadPct: 10, profitPct: 10,
  paymentTerms: '10% at signing.', exclusions: 'Permits.',
  notes: null, createdAt: new Date('2026-03-19'),
  client: { name: 'Acme Corp', company: 'Acme Corp', email: 'acme@example.com', phone: null },
  sections: [
    {
      id: 's1', title: 'Framing', position: 0,
      items: [{ id: 'i1', description: 'Metal stud framing', quantity: 1, unit: 'ls', unitPrice: 5000, isMaterial: false, position: 0 }],
    },
  ],
};

it('renders quote title and client name', () => {
  const html = renderQuoteHtml(mockQuote as any);
  expect(html).toContain('Office TI');
  expect(html).toContain('Acme Corp');
  expect(html).toContain('123 Main St');
});

it('renders line item description', () => {
  const html = renderQuoteHtml(mockQuote as any);
  expect(html).toContain('Metal stud framing');
  expect(html).toContain('5,000');
});

it('is self-contained HTML (has html/head/body)', () => {
  const html = renderQuoteHtml(mockQuote as any);
  expect(html).toContain('<html');
  expect(html).toContain('</body>');
});
```

- [ ] **Step 2: Run test, verify fail**

```bash
npm test -- --testPathPattern=quote-template
```

- [ ] **Step 3: Create `lib/docs/quote-template.ts`**

Implement `renderQuoteHtml(quote)`. The quote parameter type should be the Prisma result of:

```ts
prisma.quote.findUnique({
  where: { id },
  include: {
    client: true,
    sections: { include: { items: { orderBy: { position: 'asc' } } }, orderBy: { position: 'asc' } },
  },
})
```

The HTML should:
- Be self-contained (inline styles, no external CSS links)
- Match the visual structure of `proposals/[slug]/page.tsx` (Building NV header, client/site info, line items, totals, terms, exclusions)
- Use `calculateQuoteTotals` from `lib/pricing` for the totals block
- Include a `</body>` tag so `pdf.ts` can inject the signature block

```ts
// src/lib/docs/quote-template.ts
import { calculateQuoteTotals } from '@/lib/pricing';

type QuoteWithRelations = /* the Prisma include shape above */ any;

export function renderQuoteHtml(quote: QuoteWithRelations): string {
  const allItems = quote.sections.flatMap((s: any) =>
    s.items.map((i: any) => ({ unitPrice: i.unitPrice, quantity: i.quantity, isMaterial: i.isMaterial }))
  );
  const totals = calculateQuoteTotals(allItems, quote.materialMarkupPct, quote.overheadPct, quote.profitPct);
  const dateStr = new Date(quote.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const lineItemsHtml = quote.sections.map((sec: any) => `
    <div style="margin-bottom:24px;">
      <h2 style="font-weight:bold;text-decoration:underline;margin-bottom:12px;">${sec.title}:</h2>
      ${sec.items.map((item: any) => `
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
          <span>— ${item.description}</span>
          <span>$${(item.quantity * item.unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>`).join('')}
    </div>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: sans-serif; color: #111; max-width: 720px; margin: 0 auto; padding: 48px 32px; font-size: 14px; line-height: 1.5; }
  h1 { margin: 0; font-size: 20px; }
  .label { font-size: 10px; text-transform: uppercase; letter-spacing: .1em; color: #888; margin-bottom: 4px; }
  .divider { border: none; border-top: 1px solid #e0e0e0; margin: 24px 0; }
  .total-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; color: #555; }
  .total-final { display: flex; justify-content: space-between; font-weight: bold; font-size: 16px; border-top: 1px solid #ccc; padding-top: 10px; margin-top: 10px; }
</style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid #e0e0e0;">
    <div>
      <h1>Building NV</h1>
      <p style="color:#666;font-size:13px;margin:4px 0 0;">Commercial Tenant Improvement · Reno, Nevada</p>
    </div>
    <div style="text-align:right;">
      <p style="font-size:18px;font-weight:bold;margin:0;">PROPOSAL</p>
      <p style="color:#666;font-size:13px;margin:4px 0 0;">${dateStr}</p>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid #e0e0e0;">
    <div>
      <p class="label">Client</p>
      <p style="font-weight:600;margin:0;">${quote.client.name}</p>
      ${quote.client.company ? `<p style="color:#666;font-size:13px;margin:2px 0 0;">${quote.client.company}</p>` : ''}
    </div>
    <div>
      <p class="label">Job Site</p>
      <p style="font-weight:600;margin:0;">${quote.address}</p>
      <p style="color:#666;font-size:13px;margin:2px 0 0;">${quote.projectType}</p>
    </div>
  </div>

  <p style="color:#555;margin-bottom:32px;">Building NV proposes to perform the following work as outlined below.</p>

  ${lineItemsHtml}

  <hr class="divider">

  ${totals.materialsMarkupAmount > 0 ? `<div class="total-row"><span>Materials Markup (${quote.materialMarkupPct}%)</span><span>$${totals.materialsMarkupAmount.toFixed(2)}</span></div>` : ''}
  <div class="total-row"><span>Overhead (${quote.overheadPct}%)</span><span>$${totals.overheadAmount.toFixed(2)}</span></div>
  <div class="total-row"><span>Profit (${quote.profitPct}%)</span><span>$${totals.profitAmount.toFixed(2)}</span></div>
  <div class="total-final"><span>Total Cost:</span><span>$${totals.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>

  <hr class="divider">

  <div style="margin-bottom:24px;">
    <h3 style="font-weight:bold;text-decoration:underline;margin-bottom:8px;">Note:</h3>
    <p style="font-size:13px;">${quote.paymentTerms}</p>
  </div>

  <div style="margin-bottom:24px;">
    <h3 style="font-weight:bold;text-decoration:underline;margin-bottom:8px;">Exclusions</h3>
    <div style="border:1px solid #ccc;padding:12px;font-size:13px;">${quote.exclusions}</div>
  </div>

  <div style="margin-bottom:40px;font-size:12px;color:#555;">
    <h3 style="font-weight:bold;text-decoration:underline;margin-bottom:8px;font-size:13px;">Terms & Conditions:</h3>
    <p><strong>A.</strong> Interest of 2% per month on overdue accounts.</p>
    <p><strong>B.</strong> Any alteration from above specifications will be charged via written change order.</p>
    <p><strong>C.</strong> All agreements contingent upon strikes, accidents, or delays beyond our control.</p>
    <p><strong>D.</strong> Warranty void by act of God or non-payment. Coverage begins at final payment.</p>
    <p><strong>E.</strong> Unforeseen conditions not included. Additional fees added via change order.</p>
    <p><strong>F.</strong> Payment due net 30 from invoice date.</p>
  </div>

  <div style="margin-top:48px;padding-top:24px;border-top:1px solid #e0e0e0;">
    <p style="font-size:12px;color:#888;">By signing below, you authorize Building NV to proceed with the above scope and agree to the stated terms.</p>
  </div>
</body>
</html>`;
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
npm test -- --testPathPattern=quote-template
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/docs/quote-template.ts src/__tests__/docs/quote-template.test.ts
git commit -m "feat: add quote HTML renderer for PDF/signing"
```

---

## Task 5: MSA Template

**Files:**
- Create: `lib/docs/msa-template.ts`
- Test: `src/__tests__/docs/msa-template.test.ts`

The MSA is a parameterized boilerplate. It renders as a standalone HTML document. The signed quote will be appended to it as Exhibit A (a separate section at the end, separated by a page break) before the combined doc goes for contract signature.

- [ ] **Step 1: Write failing test**

```ts
// src/__tests__/docs/msa-template.test.ts
import { renderMsaHtml } from '@/lib/docs/msa-template';

const opts = {
  clientName: 'Acme Corp',
  projectTitle: 'Office TI — 123 Main St',
  projectAddress: '123 Main St, Reno NV 89501',
  contractorLicense: 'NV B2 #[LICENSE]',
  effectiveDate: 'March 19, 2026',
  exhibitATitle: 'Signed Proposal — Office TI',
};

it('includes client name', () => {
  expect(renderMsaHtml(opts)).toContain('Acme Corp');
});

it('includes project address', () => {
  expect(renderMsaHtml(opts)).toContain('123 Main St, Reno NV 89501');
});

it('references Exhibit A', () => {
  expect(renderMsaHtml(opts)).toContain('Exhibit A');
});

it('is self-contained HTML', () => {
  const html = renderMsaHtml(opts);
  expect(html).toContain('<html');
  expect(html).toContain('</body>');
});
```

- [ ] **Step 2: Run test, verify fail**

```bash
npm test -- --testPathPattern=msa-template
```

- [ ] **Step 3: Create `lib/docs/msa-template.ts`**

The MSA covers the primary legal bases for a Nevada general contracting engagement. Parameters are interpolated into the boilerplate. Key sections to include:

1. Parties (Building NV LLC + Client)
2. Scope of Work (by reference to Exhibit A — the signed quote)
3. Payment Terms (from the quote's paymentTerms field)
4. Change Orders (written COs only, signed by both parties)
5. Warranty (1 year on workmanship from substantial completion)
6. Insurance (Building NV maintains GL + workers comp)
7. Dispute Resolution (Nevada, binding arbitration)
8. License Disclosure (NV Contractor License #)
9. Signature block (two parties — Client + Building NV rep)

```ts
// src/lib/docs/msa-template.ts
export interface MsaOptions {
  clientName: string;
  projectTitle: string;
  projectAddress: string;
  contractorLicense: string;
  effectiveDate: string;
  exhibitATitle: string;
  paymentTerms?: string;
}

export function renderMsaHtml(opts: MsaOptions): string {
  const payment = opts.paymentTerms ?? '10% due at signing. 25% due after materials purchased. Balance due net 30.';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: serif; color: #111; max-width: 720px; margin: 0 auto; padding: 48px 32px; font-size: 13px; line-height: 1.7; }
  h1 { font-size: 18px; text-align: center; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 4px; }
  .center { text-align: center; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; margin-top: 28px; margin-bottom: 8px; }
  .parties { border: 1px solid #ccc; padding: 16px 20px; margin: 24px 0; font-size: 13px; }
  .sig-block { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-top: 48px; }
  .sig-line { border-top: 1px solid #333; padding-top: 8px; font-size: 12px; color: #555; }
</style>
</head>
<body>

  <h1>Master Service Agreement</h1>
  <p class="center" style="color:#666;font-size:12px;">${opts.effectiveDate}</p>

  <div class="parties">
    <p><strong>Contractor:</strong> Building NV, LLC, a Nevada limited liability company · ${opts.contractorLicense}</p>
    <p><strong>Client:</strong> ${opts.clientName}</p>
    <p><strong>Project:</strong> ${opts.projectTitle}</p>
    <p><strong>Site Address:</strong> ${opts.projectAddress}</p>
  </div>

  <h2>1. Scope of Work</h2>
  <p>Contractor shall perform the work described in Exhibit A (Signed Proposal — "${opts.exhibitATitle}"), which is incorporated herein by reference. The signed proposal constitutes the complete scope of work and pricing for this engagement.</p>

  <h2>2. Payment Terms</h2>
  <p>${payment} All invoices are due net 30. Interest of 2% per month accrues on overdue balances beginning on the day of delinquency. Client shall not withhold payment for work completed.</p>

  <h2>3. Change Orders</h2>
  <p>Any deviation from the scope in Exhibit A, including unforeseen conditions, owner-requested changes, or material substitutions, requires a written Change Order signed by both parties before work proceeds. Change Orders state the scope change, price adjustment, and any schedule impact. Verbal authorizations are not binding.</p>

  <h2>4. Warranty</h2>
  <p>Contractor warrants workmanship for one (1) year from the date of substantial completion. Warranty covers defects in installation. It does not cover damage from acts of God, earthquake, misuse, non-payment, or conditions outside Contractor's scope. Materials carry manufacturer warranties only.</p>

  <h2>5. Insurance</h2>
  <p>Contractor maintains commercial general liability insurance and workers' compensation coverage as required by Nevada law. Certificates of insurance are available upon request.</p>

  <h2>6. Contractor's License</h2>
  <p>Building NV, LLC holds Nevada Contractor License ${opts.contractorLicense}. As required by NRS 624, no payment is due for work performed without a valid license. Contractor represents its license is active and in good standing.</p>

  <h2>7. Dispute Resolution</h2>
  <p>Any dispute arising from this Agreement shall be resolved by binding arbitration in Reno, Nevada under the rules of the American Arbitration Association. The prevailing party is entitled to reasonable attorneys' fees. This Agreement is governed by Nevada law.</p>

  <h2>8. Entire Agreement</h2>
  <p>This Agreement and Exhibit A constitute the entire agreement between the parties. No prior representations, warranties, or understandings not contained herein are binding. Amendments must be in writing and signed by both parties.</p>

  <div class="sig-block">
    <div>
      <p style="margin-bottom:48px;"><strong>Client</strong></p>
      <div class="sig-line">Signature</div>
      <div class="sig-line" style="margin-top:16px;">${opts.clientName} · Date</div>
    </div>
    <div>
      <p style="margin-bottom:48px;"><strong>Building NV, LLC</strong></p>
      <div class="sig-line">Signature</div>
      <div class="sig-line" style="margin-top:16px;">Cody McDannald, Building NV · Date</div>
    </div>
  </div>

  <hr style="margin-top:60px;border:none;border-top:2px solid #ccc;">
  <p style="text-align:center;font-size:11px;color:#888;margin-top:16px;font-family:sans-serif;text-transform:uppercase;letter-spacing:.1em;">Exhibit A follows</p>

</body>
</html>`;
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
npm test -- --testPathPattern=msa-template
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/docs/msa-template.ts src/__tests__/docs/msa-template.test.ts
git commit -m "feat: add MSA boilerplate template"
```

---

## Task 6: Change Order Template

**Files:**
- Create: `lib/docs/change-order-template.ts`
- Test: `src/__tests__/docs/change-order-template.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/__tests__/docs/change-order-template.test.ts
import { renderChangeOrderHtml } from '@/lib/docs/change-order-template';

const opts = {
  coNumber: 1,
  projectTitle: 'Office TI — 123 Main St',
  clientName: 'Acme Corp',
  contractDate: 'March 19, 2026',
  scopeDelta: 'Add (2) additional electrical outlets in conference room.',
  priceDelta: 850,
  originalContractAmount: 45000,
  effectiveDate: 'March 25, 2026',
};

it('renders CO number and project title', () => {
  const html = renderChangeOrderHtml(opts);
  expect(html).toContain('Change Order #1');
  expect(html).toContain('Office TI — 123 Main St');
});

it('renders scope delta and price delta', () => {
  const html = renderChangeOrderHtml(opts);
  expect(html).toContain('additional electrical outlets');
  expect(html).toContain('850');
});

it('calculates revised contract amount', () => {
  const html = renderChangeOrderHtml(opts);
  expect(html).toContain('45,850');
});
```

- [ ] **Step 2: Run test, verify fail**

- [ ] **Step 3: Create `lib/docs/change-order-template.ts`**

```ts
// src/lib/docs/change-order-template.ts
export interface ChangeOrderOptions {
  coNumber: number;
  projectTitle: string;
  clientName: string;
  contractDate: string;
  scopeDelta: string;
  priceDelta: number; // positive = addition, negative = credit
  originalContractAmount: number;
  effectiveDate: string;
}

export function renderChangeOrderHtml(opts: ChangeOrderOptions): string {
  const revised = opts.originalContractAmount + opts.priceDelta;
  const sign = opts.priceDelta >= 0 ? '+' : '';
  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2 });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: sans-serif; color: #111; max-width: 720px; margin: 0 auto; padding: 48px 32px; font-size: 13px; line-height: 1.6; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .meta { color: #666; font-size: 12px; margin-bottom: 32px; }
  .box { border: 1px solid #ccc; padding: 20px 24px; margin: 24px 0; border-radius: 4px; }
  .row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; }
  .row.total { font-weight: bold; font-size: 15px; border-top: 1px solid #ccc; padding-top: 10px; margin-top: 10px; }
  .sig-block { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-top: 48px; }
  .sig-line { border-top: 1px solid #333; padding-top: 8px; font-size: 12px; color: #555; }
  label { font-size: 10px; text-transform: uppercase; letter-spacing: .1em; color: #888; display: block; margin-bottom: 4px; }
</style>
</head>
<body>
  <h1>Change Order #${opts.coNumber}</h1>
  <p class="meta">
    Project: ${opts.projectTitle} &nbsp;·&nbsp;
    Client: ${opts.clientName} &nbsp;·&nbsp;
    Original Contract: ${opts.contractDate} &nbsp;·&nbsp;
    CO Date: ${opts.effectiveDate}
  </p>

  <div class="box">
    <label>Scope Change</label>
    <p style="margin:0;">${opts.scopeDelta}</p>
  </div>

  <div class="box">
    <div class="row"><span>Original Contract Amount</span><span>$${fmt(opts.originalContractAmount)}</span></div>
    <div class="row"><span>Change Order Amount</span><span>${sign}$${fmt(Math.abs(opts.priceDelta))}</span></div>
    <div class="row total"><span>Revised Contract Amount</span><span>$${fmt(revised)}</span></div>
  </div>

  <p style="font-size:12px;color:#666;">By signing, both parties authorize the scope change and price adjustment described above. This Change Order is incorporated into the original contract.</p>

  <div class="sig-block">
    <div>
      <p style="margin-bottom:48px;"><strong>Client</strong></p>
      <div class="sig-line">Signature</div>
      <div class="sig-line" style="margin-top:16px;">${opts.clientName} · Date</div>
    </div>
    <div>
      <p style="margin-bottom:48px;"><strong>Building NV, LLC</strong></p>
      <div class="sig-line">Signature</div>
      <div class="sig-line" style="margin-top:16px;">Building NV · Date</div>
    </div>
  </div>
</body>
</html>`;
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
npm test -- --testPathPattern=change-order-template
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/docs/change-order-template.ts src/__tests__/docs/change-order-template.test.ts
git commit -m "feat: add change order template"
```

---

## Task 7: Quote Sending + Signature Capture (upgrading existing flow)

**Files:**
- Create: `src/app/api/quotes/[id]/send/route.ts`
- Create: `src/app/api/sign/quote/[token]/route.ts`
- Modify: `src/app/proposals/[slug]/page.tsx` (switch to token-based lookup, keep slug fallback)
- Modify: `src/app/proposals/[slug]/AcceptanceBlock.tsx` (add signature pad)
- Modify: `src/app/api/proposals/[slug]/accept/route.ts` (kept for backwards compat but deprecated)

The existing `/proposals/[slug]` flow stays working. New flow: internal user hits "Send for Signature" → quote gets a `signingToken` → client gets emailed a link to `/proposals/[token]` (which the page.tsx already handles via slug lookup, but we'll add token support). The signature is captured server-side, not just a click.

- [ ] **Step 1: Write failing test for send route**

```ts
// src/__tests__/quotes/send.test.ts
import { POST } from '@/app/api/quotes/[id]/send/route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

// Requires a quote in the test DB — run after seeding
it('returns 404 for non-existent quote', async () => {
  const req = new NextRequest('http://localhost/api/quotes/nonexistent/send', { method: 'POST' });
  const res = await POST(req, { params: Promise.resolve({ id: 'nonexistent' }) });
  expect(res.status).toBe(404);
});
```

- [ ] **Step 2: Run test, verify fail**

```bash
npm test -- --testPathPattern=quotes/send
```

- [ ] **Step 3: Create `src/app/api/quotes/[id]/send/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendSigningLink } from '@/lib/docs/email';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { client: true },
  });

  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (quote.status === 'quote_signed') return NextResponse.json({ error: 'Already signed' }, { status: 409 });
  if (!quote.client.email) return NextResponse.json({ error: 'Client has no email address' }, { status: 422 });

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await prisma.quote.update({
    where: { id },
    data: {
      signingToken: token,
      signingTokenExpiresAt: expiresAt,
      status: 'sent',
      sentAt: new Date(),
    },
  });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const signingUrl = `${baseUrl}/proposals/${token}`;

  await sendSigningLink({
    toEmail: quote.client.email,
    toName: quote.client.name,
    projectTitle: quote.title,
    signingUrl,
    docLabel: 'Proposal',
  });

  return NextResponse.json({ token, signingUrl });
}
```

- [ ] **Step 4: Run test, verify pass**

```bash
npm test -- --testPathPattern=quotes/send
```

- [ ] **Step 5: Update `proposals/[slug]/page.tsx`**

The page currently looks up by `slug`. Extend it to also accept a `signingToken` (UUIDs won't match slug format so a simple try-both approach works):

```ts
// In ProposalPage, replace the findUnique call:
const quote = await prisma.quote.findFirst({
  where: {
    OR: [
      { slug: slug },
      { signingToken: slug }, // token-based lookup for emailed signing links
    ],
  },
  include: {
    client: true,
    sections: {
      include: { items: { orderBy: { position: 'asc' } } },
      orderBy: { position: 'asc' },
    },
    acceptance: true,
  },
});
```

Also pass `quote.signingToken` as a `token` prop to `AcceptanceBlock` so it knows which route to POST to.

- [ ] **Step 6: Upgrade `AcceptanceBlock.tsx` to use signature pad**

Replace the existing "I Accept" button with a signature pad. `AcceptanceBlock` is a client component (`'use client'`). Loading `signature_pad.min.js` via a raw `<script>` tag doesn't work reliably in App Router client components because the script may not execute before the canvas is initialized.

**Use the npm package instead of the public file:**

```bash
npm install signature_pad
```

Then import it dynamically in the component (it accesses `window`, so it must be loaded client-side only):

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import SignaturePad from 'signature_pad'; // npm package

export default function AcceptanceBlock({ token, accepted, ... }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);

  useEffect(() => {
    if (!canvasRef.current || accepted) return;
    padRef.current = new SignaturePad(canvasRef.current);
    // resize handler
    const resize = () => {
      const canvas = canvasRef.current!;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext('2d')?.scale(ratio, ratio);
      padRef.current?.clear();
    };
    window.addEventListener('resize', resize);
    resize();
    return () => window.removeEventListener('resize', resize);
  }, [accepted]);

  async function handleSubmit() {
    if (!padRef.current || padRef.current.isEmpty()) {
      alert('Please sign before submitting.');
      return;
    }
    const signature = padRef.current.toDataURL('image/png');
    // POST to /api/sign/quote/[token]
    const res = await fetch(`/api/sign/quote/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signature, signerName }),
    });
    if (res.ok) { /* show success state */ }
  }
  // render canvas + submit button
}
```

The `token` prop is the `signingToken` from the quote. The page passes it when rendering. The old accept route remains for backwards compat for quotes sent before this change.

- [ ] **Step 7: Create `src/app/api/sign/quote/[token]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateSignedPDF } from '@/lib/docs/pdf';
import { sendSignedPDF } from '@/lib/docs/email';
import { renderQuoteHtml } from '@/lib/docs/quote-template';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const DOCS_DIR = () => process.env.DOCS_DIR ?? path.join(process.cwd(), 'docs-storage');

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const quote = await prisma.quote.findFirst({
    where: { signingToken: token },
    include: {
      client: true,
      sections: { include: { items: { orderBy: { position: 'asc' } } }, orderBy: { position: 'asc' } },
      acceptance: true,
    },
  });

  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (quote.status === 'quote_signed') return NextResponse.json({ error: 'Already signed' }, { status: 409 });

  if (quote.signingTokenExpiresAt && new Date() > quote.signingTokenExpiresAt) {
    return NextResponse.json({ error: 'Link expired' }, { status: 410 });
  }

  const body = await req.json() as { signature?: string; signerName?: string };
  if (!body.signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  if (!body.signerName) return NextResponse.json({ error: 'Missing signerName' }, { status: 400 });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip') ?? 'unknown';
  const docsDir = DOCS_DIR();
  mkdirSync(docsDir, { recursive: true });

  // Save signature PNG
  const sigBase64 = body.signature.replace(/^data:image\/png;base64,/, '');
  const sigPath = path.join(docsDir, `${token}-sig.png`);
  writeFileSync(sigPath, Buffer.from(sigBase64, 'base64'));

  // Generate signed PDF
  const quoteHtml = renderQuoteHtml(quote);
  const pdfPath = path.join(docsDir, `${token}-signed.pdf`);
  await generateSignedPDF(quoteHtml, pdfPath, body.signature);

  const signedAt = new Date();

  // Upsert Acceptance with signature
  if (quote.acceptance) {
    await prisma.acceptance.update({
      where: { quoteId: quote.id },
      data: { signerName: body.signerName, signaturePngPath: sigPath, acceptedAt: signedAt, ipAddress: ip },
    });
  } else {
    await prisma.acceptance.create({
      data: { quoteId: quote.id, signerName: body.signerName, signaturePngPath: sigPath, acceptedAt: signedAt, ipAddress: ip },
    });
  }

  await prisma.quote.update({
    where: { id: quote.id },
    data: { status: 'quote_signed', signedAt, signedPdfPath: pdfPath },
  });

  // Send PDF — don't fail request if email fails
  if (quote.client.email) {
    try {
      await sendSignedPDF({
        toEmail: quote.client.email,
        toName: quote.client.name,
        projectTitle: quote.title,
        signedPdfPath: pdfPath,
        docLabel: 'Proposal',
      });
    } catch (err) {
      console.error('Email failed after signing:', err);
    }
  }

  return NextResponse.json({ ok: true, signedAt: signedAt.toISOString() });
}
```

- [ ] **Step 8: Smoke test manually**

1. Start dev server: `npm run dev`
2. Create a quote with a client that has an email
3. Hit `POST /api/quotes/[id]/send` from the internal UI (or curl with session cookie)
4. Verify quote gets `signingToken`, status = `sent`
5. Open the signing URL in browser, sign, submit
6. Verify quote status = `quote_signed`, PDF exists at `docs-storage/[token]-signed.pdf`

- [ ] **Step 9: Commit**

```bash
git add src/app/api/quotes/[id]/send/ src/app/api/sign/quote/ \
        src/app/proposals/ src/lib/docs/
git commit -m "feat: quote signing flow — send link, capture signature, generate PDF"
```

---

## Task 8: Contract Assembly + Sending

**Files:**
- Create: `src/app/api/quotes/[id]/convert-to-contract/route.ts`
- Create: `src/app/api/contracts/route.ts`
- Create: `src/app/api/contracts/[id]/route.ts`
- Create: `src/app/api/contracts/[id]/send/route.ts`
- Create: `src/app/api/sign/contract/[token]/route.ts`
- Create: `src/app/contracts/[token]/page.tsx` (public signing page)

- [ ] **Step 1: Write failing test for convert-to-contract**

```ts
// src/__tests__/contracts/convert.test.ts
import { POST } from '@/app/api/quotes/[id]/convert-to-contract/route';
import { NextRequest } from 'next/server';

it('returns 404 for non-existent quote', async () => {
  const req = new NextRequest('http://localhost', { method: 'POST' });
  const res = await POST(req, { params: Promise.resolve({ id: 'bad-id' }) });
  expect(res.status).toBe(404);
});
```

- [ ] **Step 2: Create `src/app/api/quotes/[id]/convert-to-contract/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { renderQuoteHtml } from '@/lib/docs/quote-template';
import { renderMsaHtml } from '@/lib/docs/msa-template';
import { calculateQuoteTotals } from '@/lib/pricing';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const DOCS_DIR = () => process.env.DOCS_DIR ?? path.join(process.cwd(), 'docs-storage');

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      client: true,
      sections: { include: { items: { orderBy: { position: 'asc' } } }, orderBy: { position: 'asc' } },
    },
  });

  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (quote.status !== 'quote_signed') {
    return NextResponse.json({ error: 'Quote must be signed before converting to contract' }, { status: 422 });
  }

  // Check if contract already exists
  const existing = await prisma.contract.findUnique({ where: { quoteId: id } });
  if (existing) return NextResponse.json(existing);

  const effectiveDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const docsDir = DOCS_DIR();
  mkdirSync(docsDir, { recursive: true });

  // Assemble: MSA HTML + page break + Quote HTML (Exhibit A)
  const msaHtml = renderMsaHtml({
    clientName: quote.client.name,
    projectTitle: quote.title,
    projectAddress: quote.address,
    contractorLicense: process.env.BNV_LICENSE ?? 'NV B2 #[LICENSE]',
    effectiveDate,
    exhibitATitle: quote.title,
    paymentTerms: quote.paymentTerms,
  });

  const quoteHtml = renderQuoteHtml(quote);
  // Inject the quote body content into the MSA as Exhibit A
  const exhibitA = `
<div style="page-break-before:always;">
  <p style="text-align:center;font-size:11px;font-family:sans-serif;text-transform:uppercase;letter-spacing:.1em;color:#888;padding:16px 0;">Exhibit A — Signed Proposal</p>
  ${quoteHtml.replace(/<!DOCTYPE html>[\s\S]*?<body[^>]*>/i, '').replace(/<\/body>[\s\S]*?<\/html>/i, '')}
</div>`;

  const contractHtml = msaHtml.replace('</body>', `${exhibitA}\n</body>`);

  // Compute contract amount from quote totals — used as baseline for CO math
  const allItems = quote.sections.flatMap((s: any) =>
    s.items.map((i: any) => ({ unitPrice: i.unitPrice, quantity: i.quantity, isMaterial: i.isMaterial }))
  );
  const totals = calculateQuoteTotals(allItems, quote.materialMarkupPct, quote.overheadPct, quote.profitPct);

  const contractId = randomUUID();
  const htmlPath = path.join(docsDir, `${contractId}-contract.html`);
  writeFileSync(htmlPath, contractHtml, 'utf-8');

  const contract = await prisma.contract.create({
    data: {
      id: contractId,
      quoteId: quote.id,
      projectId: quote.projectId,
      htmlPath,
      contractAmount: totals.total,
      status: 'draft',
    },
  });

  return NextResponse.json(contract);
}
```

- [ ] **Step 3: Write failing test for contract send route**

```ts
// src/__tests__/contracts/send.test.ts
import { POST } from '@/app/api/contracts/[id]/send/route';
import { NextRequest } from 'next/server';

it('returns 404 for non-existent contract', async () => {
  const req = new NextRequest('http://localhost/api/contracts/bad-id/send', { method: 'POST' });
  const res = await POST(req, { params: Promise.resolve({ id: 'bad-id' }) });
  expect(res.status).toBe(404);
});
```

Run: `npm test -- --testPathPattern=contracts/send` — Expected: FAIL (module not found)

- [ ] **Step 4: Create `src/app/api/contracts/[id]/send/route.ts`**

Mirrors the quote send route: generate token, update Contract, email client signing link to `/contracts/[token]`.

```ts
// Pattern identical to src/app/api/quotes/[id]/send/route.ts with these changes:
// - Find contract by id (not quote), include: { quote: { include: { client: true } } }
// - Use contract.quote.client for email + name
// - Signing URL: /contracts/${token}
// - Update contract (not quote): { signingToken: token, signingTokenExpiresAt, status: 'contract_sent', sentAt: new Date() }
// - 422 guard: if contract.status === 'executed', return already-executed error
// - Doc label: 'Contract'
```

Run test: `npm test -- --testPathPattern=contracts/send` — Expected: PASS (404 test only at this stage)

- [ ] **Step 4: Create `src/app/api/sign/contract/[token]/route.ts`**

Mirrors `sign/quote/[token]` with one critical difference: the contract's HTML lives on disk at `contract.htmlPath`. You must read it before passing to `generateSignedPDF`, which takes an HTML string — not a file path:

```ts
import { readFileSync } from 'fs';
// ...
const contractHtml = readFileSync(contract.htmlPath, 'utf-8');
const pdfPath = path.join(docsDir, `${token}-contract-signed.pdf`);
await generateSignedPDF(contractHtml, pdfPath, body.signature);
```

Finds contract by signingToken, generates PDF, updates contract status to `executed`, emails signed PDF. Additionally: when `executed`, update `project.stage` to `contract_signed`:

```ts
if (contract.projectId) {
  await prisma.project.update({
    where: { id: contract.projectId },
    data: { stage: 'contract_signed' },
  });
}
```

- [ ] **Step 5: Create the contract HTML serve route**

Create `src/app/api/contracts/[id]/html/route.ts` — a public `GET` route that reads the contract's `htmlPath` from disk and returns it as `text/html`. This is what the iframe will load.

```ts
// src/app/api/contracts/[id]/html/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readFileSync } from 'fs';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // id here is the signingToken (used as the URL param on the public page)
  const contract = await prisma.contract.findFirst({
    where: { signingToken: id },
  });
  if (!contract || !contract.htmlPath) return new NextResponse('Not found', { status: 404 });
  const html = readFileSync(contract.htmlPath, 'utf-8');
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });
}
```

- [ ] **Step 6: Create `src/app/contracts/[token]/page.tsx`**

Public page (no auth). Look up contract by `signingToken` to confirm it exists and get its status. Render:

1. An `<iframe src={`/api/contracts/${token}/html`} style={{ width: '100%', height: '80vh', border: 'none' }} />` to show the assembled MSA + Exhibit A
2. Below the iframe: `AcceptanceBlock` with signature pad — posts to `/api/sign/contract/[token]`
3. If `contract.status === 'executed'`: show "Already Signed" state

The iframe approach avoids re-parsing the assembled HTML in React and renders the document exactly as it was stored.

- [ ] **Step 6: Smoke test manually**

1. Sign a quote
2. POST `/api/quotes/[id]/convert-to-contract`
3. Verify contract record created, `htmlPath` file exists
4. POST `/api/contracts/[id]/send` — verify email sent, signing URL works
5. Sign contract — verify contract status = `executed`, project stage updated

- [ ] **Step 7: Commit**

```bash
git add src/app/api/quotes/[id]/convert-to-contract/ \
        src/app/api/contracts/ src/app/api/sign/contract/ \
        src/app/contracts/
git commit -m "feat: contract assembly, send, and signing flow"
```

---

## Task 9: Change Orders

**Files:**
- Create: `src/app/api/change-orders/route.ts`
- Create: `src/app/api/change-orders/[id]/send/route.ts`
- Create: `src/app/api/sign/change-order/[token]/route.ts`
- Create: `src/app/change-orders/[token]/page.tsx`

- [ ] **Step 1: Write failing test for change order create**

```ts
// src/__tests__/change-orders/create.test.ts
import { POST } from '@/app/api/change-orders/route';
import { NextRequest } from 'next/server';

it('returns 404 for non-existent contract', async () => {
  const req = new NextRequest('http://localhost/api/change-orders', {
    method: 'POST',
    body: JSON.stringify({ contractId: 'bad-id', title: 'CO1', scopeDelta: 'Extra work', priceDelta: 500 }),
    headers: { 'Content-Type': 'application/json' },
  });
  const res = await POST(req);
  expect(res.status).toBe(404);
});

it('returns 422 if contract is not yet executed', async () => {
  // This test requires a seeded contract in draft/sent status — implement after seeding
  // Placeholder: verify the route handles this guard correctly
});
```

Run: `npm test -- --testPathPattern=change-orders/create` — Expected: FAIL (module not found)

- [ ] **Step 2: Create `src/app/api/change-orders/route.ts`**

```ts
// POST — create change order
// Body: { contractId, title, scopeDelta, priceDelta }
// 1. Find contract by contractId (include quote.client), verify it exists
// 2. If contract.status !== 'executed': return 422 — "Contract must be executed before issuing a change order"
// 3. Count existing COs on contract to get next number: await prisma.changeOrder.count({ where: { contractId } }) + 1
// 4. Render change order HTML via renderChangeOrderHtml({ coNumber, projectTitle: contract.quote.title, clientName: contract.quote.client.name, contractDate, scopeDelta, priceDelta, originalContractAmount: contract.contractAmount ?? 0, effectiveDate })
// 5. Save HTML to docs-storage/[coId]-co.html
// 6. Create ChangeOrder record with htmlPath
// 7. Return created ChangeOrder
```

Run test: `npm test -- --testPathPattern=change-orders/create` — Expected: PASS (404 test)

- [ ] **Step 2: Create send and sign routes**

Follow the exact same pattern as the contract send/sign routes. Change the doc label to 'Change Order'. Signing URL: `/change-orders/[token]`.

On CO executed: update the linked Contract's `contractAmount` by adding `priceDelta` (if the Contract has a `contractAmount` field — add one in schema if not already present).

- [ ] **Step 3: Create `src/app/change-orders/[token]/page.tsx`**

Same public signing page pattern as contracts.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/change-orders/ src/app/api/sign/change-order/ src/app/change-orders/
git commit -m "feat: change order create, send, and signing flow"
```

---

## Task 10: Internal UI — Send Button + Status Badges

**Files:**
- Modify: `src/app/internal/quotes/[id]/edit/page.tsx`

The quote edit page is the trigger point. Add:

1. **Status badge** — `draft` (gray) / `sent` (blue) / `quote_signed` (green) — visible at the top of the page
2. **"Send for Signature" button** — calls `POST /api/quotes/[id]/send`, shows a toast with the signing URL, updates badge to `sent`
3. **"Convert to Contract" button** — appears only when status = `quote_signed`, calls convert route
4. **Document history section** — at the bottom of the quote detail: shows quote signed date + PDF download link; contract status + PDF link; list of change orders

For the "Send" button UI flow:
- On click: confirm dialog ("Send signing link to [client email]?")
- POST → show success toast with the signing URL (so you can also copy/paste it manually)
- Update UI to reflect new status

- [ ] **Commit**

```bash
git add src/app/internal/quotes/
git commit -m "feat: send-for-signature button and status badges on quote detail"
```

---

## Task 11: End-to-End Smoke Test

Manual walkthrough — do this in order:

- [ ] Create a client with a valid email
- [ ] Create a quote, add line items, save
- [ ] From quote detail, click "Send for Signature"
- [ ] Verify email received with signing link
- [ ] Open signing link, sign, submit
- [ ] Verify quote status = `quote_signed`
- [ ] Verify signed PDF exists in `docs-storage/`
- [ ] Verify client received signed PDF by email
- [ ] Click "Convert to Contract"
- [ ] Verify contract record created, HTML assembled
- [ ] Send contract for signature
- [ ] Sign contract
- [ ] Verify contract status = `executed`
- [ ] Verify project stage = `contract_signed`
- [ ] Create a change order from the contract
- [ ] Send CO for signature
- [ ] Sign CO
- [ ] Verify CO status = `executed`

- [ ] **Commit (if any fixes from smoke test)**

```bash
git add -A
git commit -m "fix: smoke test corrections for signing flow"
```

---

## Environment Variables Reference

Add to `.env.local` and document for production deployment (Fly.io secrets):

```bash
RESEND_API_KEY=re_...
RESEND_FROM_NAME="Building NV"
RESEND_FROM_EMAIL="estimates@buildingnv.com"
RESEND_BCC_EMAIL="cody@buildingnv.com"         # BCC on all outbound doc emails
DOCS_DIR="./docs-storage"                       # local; Fly.io: /data/docs
NEXT_PUBLIC_BASE_URL="https://buildingnv.com"  # production URL for signing links
BNV_LICENSE="NV B2 #[LICENSE]"                 # contractor license number
PUPPETEER_EXECUTABLE_PATH=""                   # leave blank for bundled Chromium
```

---

## Notes for the Implementing Agent

- **PDF generation is slow (~2-5s)**. Don't add it to hot paths. The sign POST routes are the only place Puppeteer runs.
- **Puppeteer in Next.js**: Add `serverExternalPackages: ['puppeteer']` in `next.config.ts` to prevent bundling issues.
- **The existing `/api/proposals/[slug]/accept` route** should be left in place but treated as deprecated. New signing goes through `/api/sign/quote/[token]`.
- **Token lookup on proposal page**: The `slug` param can now be either a slug (short-lived sessions) or a signingToken (UUID). The `findFirst` with `OR` handles both — do not break existing slug-based links.
- **File storage**: All PDFs and signature PNGs go into `DOCS_DIR`. In development this is `./docs-storage/`. Add `docs-storage/` to `.gitignore`.
- **The MSA is boilerplate** — it is not legal advice and should be reviewed by a Nevada attorney before use in live contracts. Leave a comment in `msa-template.ts` noting this.
- **Change order `priceDelta`** can be negative (for credits/scope reductions). Render credits in red in the UI.
