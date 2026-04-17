# Receipt of Payment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate and deliver a styled, branded receipt of payment (HTML email + PDF attachment) to customers when an invoice is paid, with a financial summary showing total paid to date and remaining balance.

**Architecture:** New `receipt-template.ts` renders receipt HTML. New `receipt.ts` orchestrates generation (fetch data → render HTML → generate PDF buffer → send email with attachment). Both the Stripe webhook and the manual "Mark Paid" PATCH route call the same `generateAndSendReceipt()` function. A new `/api/invoices/[id]/receipt` route handles resend and PDF download.

**Tech Stack:** Next.js 16, Prisma, Puppeteer (PDF), Resend (email), TypeScript

**Spec:** `docs/superpowers/specs/2026-04-16-receipt-of-payment-design.md`

---

### Task 1: Add `generatePDFBuffer` to pdf.ts

**Files:**
- Modify: `src/lib/docs/pdf.ts:49-71`

The existing `generatePDF` writes to disk. The receipt needs an in-memory buffer for the email attachment. Add a sibling function that returns a `Buffer` instead.

- [ ] **Step 1: Add `generatePDFBuffer` function**

Add this function after the existing `generatePDF` function in `src/lib/docs/pdf.ts`:

```typescript
/**
 * HTML → PDF as in-memory Buffer (no file written).
 * Used for email attachments where we don't need to persist the PDF.
 */
export async function generatePDFBuffer(
  documentHtml: string,
): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(documentHtml, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      margin: { top: '0.75in', bottom: '0.75in', left: '0.75in', right: '0.75in' },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/docs/pdf.ts
git commit -m "feat: add generatePDFBuffer for in-memory PDF generation"
```

---

### Task 2: Create Receipt HTML Template

**Files:**
- Create: `src/lib/docs/receipt-template.ts`

This follows the same pattern as `invoice-template.ts` — a pure function that takes data and returns an HTML string. The styling matches the invoice template: system fonts, same color palette (#1f2937 text, #6b7280 muted, #e5e7eb borders), same spacing.

Key difference from invoice: the financial summary shows "total paid to date / this payment / remaining balance" instead of "previously invoiced / this invoice / remaining balance."

- [ ] **Step 1: Create `src/lib/docs/receipt-template.ts`**

```typescript
// src/lib/docs/receipt-template.ts
import 'server-only';

export interface ReceiptTemplateData {
  // Invoice reference
  invoiceNumber: string;
  // Payment details
  paidDate: Date;
  paidMethod: string; // human-readable: "Check", "ACH", "Credit Card", "ACH Bank Transfer"
  amountPaid: number;
  // Contractor info
  contractorName: string;
  contractorAddress: string;
  contractorPhone: string;
  contractorEmail: string;
  contractorLicense: string;
  // Paid by
  billingContactName: string;
  billingCompanyName: string | null;
  // Project
  projectName: string;
  projectType: string | null;
  siteAddress: string | null;
  // Financial summary
  originalContractAmount: number;
  changeOrderTotal: number;
  changeOrderCount: number;
  adjustedContractTotal: number;
  totalPaidToDate: number; // sum of all paid invoices including this one
  remainingBalance: number;
  // Footer contact
  contactName: string;
  contactPhone: string;
  contactEmail: string;
}

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtCurrency(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function renderReceiptHtml(data: ReceiptTemplateData): string {
  const coLine =
    data.changeOrderCount > 0
      ? `<tr>
      <td style="padding:6px 0;color:#666;">Change Orders (${data.changeOrderCount})</td>
      <td style="padding:6px 0;text-align:right;">${fmtCurrency(data.changeOrderTotal)}</td>
    </tr>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    color: #1f2937; max-width: 800px; margin: 0 auto; padding: 48px 40px;
    font-size: 14px; line-height: 1.5;
  }
  h1 { margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.02em; }
  h2 { font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; }
  .section { margin-bottom: 32px; }
  .divider { border: none; border-top: 1px solid #e5e7eb; margin: 32px 0; }
  .summary-row { display: flex; justify-content: space-between; padding: 6px 0; }
  .summary-row.bold { font-weight: 700; border-top: 2px solid #1f2937; padding-top: 10px; margin-top: 6px; }
</style>
</head>
<body>

<!-- Header -->
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;">
  <div>
    <h1>RECEIPT OF PAYMENT</h1>
    <p style="color:#6b7280;font-size:13px;margin:8px 0 0;">
      ${esc(data.contractorName)}<br>
      ${esc(data.contractorAddress)}<br>
      ${esc(data.contractorPhone)}<br>
      License #${esc(data.contractorLicense)}
    </p>
  </div>
  <div style="text-align:right;">
    <p style="font-size:18px;font-weight:700;margin:0;color:#1f2937;">${esc(data.invoiceNumber)}</p>
    <p style="color:#6b7280;font-size:13px;margin:8px 0 0;">
      Payment Date: ${fmtDate(data.paidDate)}
    </p>
  </div>
</div>

<!-- PAID hero block -->
<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:24px;text-align:center;margin-bottom:32px;">
  <div style="display:inline-block;background:#16a34a;color:white;font-size:12px;font-weight:700;letter-spacing:0.1em;padding:4px 16px;border-radius:4px;margin-bottom:12px;">PAID</div>
  <p style="font-size:32px;font-weight:700;margin:8px 0 4px;color:#1f2937;">${fmtCurrency(data.amountPaid)}</p>
  <p style="color:#6b7280;margin:0;font-size:14px;">${fmtDate(data.paidDate)} · ${esc(data.paidMethod)}</p>
</div>

<hr class="divider">

<!-- Parties -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:32px;">
  <div>
    <h2>From</h2>
    <p style="margin:0;font-weight:600;">${esc(data.contractorName)}</p>
    <p style="margin:2px 0 0;color:#6b7280;font-size:13px;">${esc(data.contractorEmail)}</p>
    <p style="margin:2px 0 0;color:#6b7280;font-size:13px;">${esc(data.contractorPhone)}</p>
  </div>
  <div>
    <h2>Paid By</h2>
    <p style="margin:0;font-weight:600;">${esc(data.billingContactName)}</p>
    ${data.billingCompanyName ? `<p style="margin:2px 0 0;color:#6b7280;font-size:13px;">${esc(data.billingCompanyName)}</p>` : ''}
  </div>
</div>

<!-- Project -->
<div class="section">
  <h2>Project</h2>
  <p style="margin:0;font-weight:600;">${esc(data.projectName)}</p>
  ${data.projectType ? `<p style="margin:2px 0 0;color:#6b7280;font-size:13px;">${esc(data.projectType)}</p>` : ''}
  ${data.siteAddress ? `<p style="margin:2px 0 0;color:#6b7280;font-size:13px;">${esc(data.siteAddress)}</p>` : ''}
</div>

<hr class="divider">

<!-- Financial Summary -->
<div class="section">
  <h2>Project Financial Summary</h2>
  <div style="max-width:400px;">
    <div class="summary-row">
      <span style="color:#6b7280;">Original Contract</span>
      <span>${fmtCurrency(data.originalContractAmount)}</span>
    </div>
    ${coLine}
    <div class="summary-row" style="border-top:1px solid #e5e7eb;padding-top:8px;margin-top:4px;">
      <span style="font-weight:600;">Adjusted Contract Total</span>
      <span style="font-weight:600;">${fmtCurrency(data.adjustedContractTotal)}</span>
    </div>
    <div class="summary-row" style="margin-top:12px;">
      <span style="color:#6b7280;">Total Paid to Date</span>
      <span>${fmtCurrency(data.totalPaidToDate)}</span>
    </div>
    <div class="summary-row" style="background:#f0fdf4;padding:8px 12px;border-radius:4px;margin:4px -12px;">
      <span style="font-weight:600;">This Payment</span>
      <span style="font-weight:600;">${fmtCurrency(data.amountPaid)}</span>
    </div>
    <div class="summary-row bold">
      <span>Remaining Balance</span>
      <span>${fmtCurrency(data.remainingBalance)}</span>
    </div>
  </div>
</div>

<hr class="divider">

<!-- Footer -->
<div style="text-align:center;color:#6b7280;font-size:13px;">
  <p style="margin:0 0 8px;font-weight:600;color:#1f2937;">Thank you for your business.</p>
  <p style="margin:0 0 16px;">Please retain this receipt for your records.</p>
  <p style="margin:0;">Questions? Contact ${esc(data.contactName)} · ${esc(data.contactPhone)} · ${esc(data.contactEmail)}</p>
</div>

</body>
</html>`;
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/docs/receipt-template.ts
git commit -m "feat: add receipt of payment HTML template"
```

---

### Task 3: Create Receipt Generation Orchestrator

**Files:**
- Create: `src/lib/docs/receipt.ts`
- Modify: `src/lib/docs/email.ts:130-180`

This is the shared `generateAndSendReceipt(invoiceId)` function used by both the Stripe webhook and the PATCH route. It also upgrades the email functions to support PDF attachments and branded formatting.

- [ ] **Step 1: Update `buildPaymentReceiptEmail` in `email.ts`**

Replace the existing `buildPaymentReceiptEmail` function (lines 130-152) with a branded version. Also update `sendPaymentReceipt` (lines 154-180) to accept an optional PDF buffer attachment.

In `src/lib/docs/email.ts`, replace everything from line 130 to line 180 with:

```typescript
export function buildPaymentReceiptEmail(opts: {
  recipientFirstName: string;
  projectTitle: string;
  invoiceNumber: string;
  amount: number;
  paidDate: string;
  paymentMethod: string;
  senderName: string;
}): string {
  const amountStr = `$${opts.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937;">
  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:24px;text-align:center;margin-bottom:24px;">
    <div style="display:inline-block;background:#16a34a;color:white;font-size:11px;font-weight:700;letter-spacing:0.1em;padding:3px 12px;border-radius:3px;">PAID</div>
    <p style="font-size:28px;font-weight:700;margin:8px 0 4px;">${amountStr}</p>
    <p style="color:#6b7280;margin:0;font-size:13px;">${opts.paidDate} · ${opts.paymentMethod}</p>
  </div>
  <p style="font-size:14px;">Hi ${opts.recipientFirstName},</p>
  <p style="font-size:14px;">This confirms your payment has been received for <strong>${opts.projectTitle}</strong>.</p>
  <table style="font-size:14px;margin:16px 0;border-collapse:collapse;width:100%;">
    <tr><td style="padding:6px 16px 6px 0;color:#6b7280;">Invoice</td><td style="font-weight:600;">${opts.invoiceNumber}</td></tr>
    <tr><td style="padding:6px 16px 6px 0;color:#6b7280;">Amount</td><td style="font-weight:600;">${amountStr}</td></tr>
    <tr><td style="padding:6px 16px 6px 0;color:#6b7280;">Date Paid</td><td>${opts.paidDate}</td></tr>
    <tr><td style="padding:6px 16px 6px 0;color:#6b7280;">Method</td><td>${opts.paymentMethod}</td></tr>
  </table>
  <p style="color:#6b7280;font-size:13px;">A detailed receipt is attached as a PDF for your records.</p>
  <p style="font-size:14px;">Thank you for your business.</p>
  <p style="font-size:14px;">— ${opts.senderName}<br>Building NV</p>
</div>`;
}

export async function sendPaymentReceipt(opts: {
  toEmail: string;
  toName: string;
  projectTitle: string;
  invoiceNumber: string;
  amount: number;
  paidDate: string;
  paymentMethod: string;
  pdfBuffer?: Buffer;
}): Promise<void> {
  const firstName = opts.toName.split(' ')[0] ?? opts.toName;
  const r = resend();

  const attachments = opts.pdfBuffer
    ? [{ filename: `${opts.projectTitle} — Receipt — ${opts.invoiceNumber}.pdf`, content: opts.pdfBuffer }]
    : [];

  await r.emails.send({
    from: FROM(),
    to: [opts.toEmail],
    bcc: BCC() ? [BCC()] : [],
    subject: `Payment Receipt — ${opts.invoiceNumber} — ${opts.projectTitle}`,
    html: buildPaymentReceiptEmail({
      recipientFirstName: firstName,
      projectTitle: opts.projectTitle,
      invoiceNumber: opts.invoiceNumber,
      amount: opts.amount,
      paidDate: opts.paidDate,
      paymentMethod: opts.paymentMethod,
      senderName: process.env.RESEND_FROM_NAME ?? 'Building NV',
    }),
    attachments,
  });
}
```

- [ ] **Step 2: Create `src/lib/docs/receipt.ts`**

This is the orchestrator. It fetches all required data, renders the receipt HTML, generates the PDF buffer, and sends the email. Both the Stripe webhook and PATCH route call this single function.

```typescript
// src/lib/docs/receipt.ts
import 'server-only';
import { prisma } from '@/lib/prisma';
import { renderReceiptHtml } from '@/lib/docs/receipt-template';
import { generatePDFBuffer } from '@/lib/docs/pdf';
import { sendPaymentReceipt } from '@/lib/docs/email';

const PAID_METHOD_LABELS: Record<string, string> = {
  check: 'Check',
  ach: 'ACH',
  other: 'Other',
  stripe_card: 'Credit Card',
  stripe_ach: 'ACH Bank Transfer',
};

/**
 * Generate receipt HTML, PDF, and send email for a paid invoice.
 * Called by both the Stripe webhook and the manual "Mark Paid" PATCH route.
 * Silently returns if invoice is not paid or has no billing contact email.
 */
export async function generateAndSendReceipt(invoiceId: string): Promise<void> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      billingContact: true,
      billingCompany: true,
      project: true,
      contract: {
        include: {
          changeOrders: { where: { status: 'executed' } },
        },
      },
    },
  });

  if (!invoice || invoice.status !== 'paid' || !invoice.paidAt) return;

  const contactEmail = invoice.billingContact.email;
  if (!contactEmail) return;

  // Calculate total paid to date (all paid invoices for this project)
  const paidInvoices = await prisma.invoice.findMany({
    where: { projectId: invoice.projectId, status: 'paid' },
    select: { amount: true },
  });
  const totalPaidToDate = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  // Financial summary
  const originalContractAmount = invoice.contract.contractAmount ?? 0;
  const changeOrderTotal = invoice.contract.changeOrders.reduce((sum, co) => sum + co.priceDelta, 0);
  const changeOrderCount = invoice.contract.changeOrders.length;
  const adjustedContractTotal = originalContractAmount + changeOrderTotal;
  const remainingBalance = adjustedContractTotal - totalPaidToDate;

  // Build site address
  const p = invoice.project;
  const siteAddress = p.siteAddress
    ? `${p.siteAddress}${p.siteCity ? `, ${p.siteCity}` : ''}${p.siteState ? `, ${p.siteState}` : ''} ${p.siteZip ?? ''}`.trim()
    : null;

  const billingContactName = [invoice.billingContact.firstName, invoice.billingContact.lastName]
    .filter(Boolean)
    .join(' ');

  const methodLabel = PAID_METHOD_LABELS[invoice.paidMethod ?? ''] ?? invoice.paidMethod ?? 'Other';

  // Render receipt HTML
  const html = renderReceiptHtml({
    invoiceNumber: invoice.invoiceNumber,
    paidDate: invoice.paidAt,
    paidMethod: methodLabel,
    amountPaid: invoice.amount,
    contractorName: 'CPP Painting & Construction LLC',
    contractorAddress: '5401 Longley Lane, Ste C81, Reno, NV 89511',
    contractorPhone: process.env.CONTRACTOR_PHONE ?? '',
    contractorEmail: process.env.PAYMENT_CONTACT_EMAIL ?? 'danny@buildingnv.us',
    contractorLicense: '0092515',
    billingContactName,
    billingCompanyName: invoice.billingCompany?.name ?? null,
    projectName: p.name,
    projectType: p.projectType,
    siteAddress,
    originalContractAmount,
    changeOrderTotal,
    changeOrderCount,
    adjustedContractTotal,
    totalPaidToDate,
    remainingBalance,
    contactName: process.env.PAYMENT_CONTACT_NAME ?? 'Danny Cox',
    contactPhone: process.env.PAYMENT_CONTACT_PHONE ?? '',
    contactEmail: process.env.PAYMENT_CONTACT_EMAIL ?? 'danny@buildingnv.us',
  });

  // Generate PDF buffer
  const pdfBuffer = await generatePDFBuffer(html);

  // Send email with PDF attached
  await sendPaymentReceipt({
    toEmail: contactEmail,
    toName: billingContactName,
    projectTitle: p.name,
    invoiceNumber: invoice.invoiceNumber,
    amount: invoice.amount,
    paidDate: invoice.paidAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    paymentMethod: methodLabel,
    pdfBuffer,
  });
}

/**
 * Generate receipt PDF buffer for download (no email).
 * Returns null if invoice is not paid.
 */
export async function generateReceiptPDF(invoiceId: string): Promise<{ buffer: Buffer; filename: string } | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      billingContact: true,
      billingCompany: true,
      project: true,
      contract: {
        include: {
          changeOrders: { where: { status: 'executed' } },
        },
      },
    },
  });

  if (!invoice || invoice.status !== 'paid' || !invoice.paidAt) return null;

  const paidInvoices = await prisma.invoice.findMany({
    where: { projectId: invoice.projectId, status: 'paid' },
    select: { amount: true },
  });
  const totalPaidToDate = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  const originalContractAmount = invoice.contract.contractAmount ?? 0;
  const changeOrderTotal = invoice.contract.changeOrders.reduce((sum, co) => sum + co.priceDelta, 0);
  const changeOrderCount = invoice.contract.changeOrders.length;
  const adjustedContractTotal = originalContractAmount + changeOrderTotal;
  const remainingBalance = adjustedContractTotal - totalPaidToDate;

  const p = invoice.project;
  const siteAddress = p.siteAddress
    ? `${p.siteAddress}${p.siteCity ? `, ${p.siteCity}` : ''}${p.siteState ? `, ${p.siteState}` : ''} ${p.siteZip ?? ''}`.trim()
    : null;

  const billingContactName = [invoice.billingContact.firstName, invoice.billingContact.lastName]
    .filter(Boolean)
    .join(' ');

  const methodLabel = PAID_METHOD_LABELS[invoice.paidMethod ?? ''] ?? invoice.paidMethod ?? 'Other';

  const html = renderReceiptHtml({
    invoiceNumber: invoice.invoiceNumber,
    paidDate: invoice.paidAt,
    paidMethod: methodLabel,
    amountPaid: invoice.amount,
    contractorName: 'CPP Painting & Construction LLC',
    contractorAddress: '5401 Longley Lane, Ste C81, Reno, NV 89511',
    contractorPhone: process.env.CONTRACTOR_PHONE ?? '',
    contractorEmail: process.env.PAYMENT_CONTACT_EMAIL ?? 'danny@buildingnv.us',
    contractorLicense: '0092515',
    billingContactName,
    billingCompanyName: invoice.billingCompany?.name ?? null,
    projectName: p.name,
    projectType: p.projectType,
    siteAddress,
    originalContractAmount,
    changeOrderTotal,
    changeOrderCount,
    adjustedContractTotal,
    totalPaidToDate,
    remainingBalance,
    contactName: process.env.PAYMENT_CONTACT_NAME ?? 'Danny Cox',
    contactPhone: process.env.PAYMENT_CONTACT_PHONE ?? '',
    contactEmail: process.env.PAYMENT_CONTACT_EMAIL ?? 'danny@buildingnv.us',
  });

  const pdfBuffer = await generatePDFBuffer(html);
  const filename = `${p.name} — Receipt — ${invoice.invoiceNumber}.pdf`;

  return { buffer: pdfBuffer, filename };
}
```

- [ ] **Step 3: Verify the build compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/docs/receipt.ts src/lib/docs/email.ts
git commit -m "feat: add receipt orchestrator and upgrade receipt email"
```

---

### Task 4: Wire Receipt into Stripe Webhook

**Files:**
- Modify: `src/app/api/webhooks/stripe/route.ts:84-104`

Replace the inline receipt email logic with a call to `generateAndSendReceipt`. This simplifies the webhook and ensures it uses the same branded receipt + PDF as the manual flow.

- [ ] **Step 1: Update Stripe webhook**

In `src/app/api/webhooks/stripe/route.ts`:

1. Replace the import on line 5:
   - Old: `import { sendPaymentReceipt } from '@/lib/docs/email';`
   - New: `import { generateAndSendReceipt } from '@/lib/docs/receipt';`

2. Replace lines 84-104 (the receipt sending block) with:

```typescript
    // Send payment receipt with PDF
    try {
      await generateAndSendReceipt(invoiceId);
    } catch (err) {
      // Receipt is nice-to-have — don't fail the webhook if it fails
      console.error('Failed to send payment receipt:', err);
    }
```

This removes ~20 lines of inline email assembly and replaces it with a single function call.

- [ ] **Step 2: Verify the build compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/webhooks/stripe/route.ts
git commit -m "refactor: use receipt orchestrator in Stripe webhook"
```

---

### Task 5: Wire Receipt into Manual "Mark Paid" Flow

**Files:**
- Modify: `src/app/api/invoices/[id]/route.ts:50-56`

When the PATCH route marks an invoice as paid, it should generate and send a receipt. The receipt send is non-blocking (fire and forget) so it doesn't slow down the API response.

- [ ] **Step 1: Add receipt generation to PATCH route**

In `src/app/api/invoices/[id]/route.ts`:

1. Add import at the top of the file:
```typescript
import { generateAndSendReceipt } from '@/lib/docs/receipt';
```

2. After the `prisma.invoice.update` call on line 76, before the `return NextResponse.json(updated)` on line 77, add:

```typescript
  // Fire-and-forget receipt generation for paid invoices
  if (data.status === 'paid') {
    generateAndSendReceipt(updated.id).catch((err) => {
      console.error('Failed to send payment receipt:', err);
    });
  }
```

The `.catch()` ensures any receipt failure doesn't bubble up to the API response.

- [ ] **Step 2: Verify the build compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/invoices/[id]/route.ts
git commit -m "feat: auto-send receipt when invoice manually marked paid"
```

---

### Task 6: Create Receipt API Route (Resend + Download)

**Files:**
- Create: `src/app/api/invoices/[id]/receipt/route.ts`

Two endpoints:
- `POST` — resend receipt email for a paid invoice
- `GET` — download receipt PDF for a paid invoice

- [ ] **Step 1: Create `src/app/api/invoices/[id]/receipt/route.ts`**

```typescript
// src/app/api/invoices/[id]/receipt/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateAndSendReceipt, generateReceiptPDF } from '@/lib/docs/receipt';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  if (invoice.status !== 'paid') {
    return NextResponse.json({ error: 'Invoice is not paid — cannot send receipt' }, { status: 422 });
  }

  await generateAndSendReceipt(id);
  return NextResponse.json({ message: 'Receipt sent' });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const result = await generateReceiptPDF(id);
  if (!result) {
    return NextResponse.json({ error: 'Invoice not found or not paid' }, { status: 404 });
  }

  return new NextResponse(result.buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    },
  });
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/invoices/[id]/receipt/route.ts
git commit -m "feat: add receipt resend and PDF download API routes"
```

---

### Task 7: Add Receipt Buttons to Internal Invoice Detail

**Files:**
- Modify: `src/app/internal/projects/[id]/invoices/[invoiceId]/InvoiceActions.tsx`

Add "Resend Receipt" button and "Download Receipt" link, visible only when the invoice status is "paid."

- [ ] **Step 1: Update InvoiceActions component**

In `src/app/internal/projects/[id]/invoices/[invoiceId]/InvoiceActions.tsx`:

1. Add state for receipt actions. After the existing `useState` declarations (lines 18-22), add:
```typescript
  const [sendingReceipt, setSendingReceipt] = useState(false);
  const [receiptResult, setReceiptResult] = useState('');
```

2. Add the resend receipt handler. After the `markPaid` function (after line 56), add:
```typescript
  const resendReceipt = async () => {
    setSendingReceipt(true);
    setError('');
    setReceiptResult('');
    const res = await fetch(`/api/invoices/${invoiceId}/receipt`, { method: 'POST' });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Failed to send receipt');
      setSendingReceipt(false);
      return;
    }
    setReceiptResult('Receipt sent!');
    setSendingReceipt(false);
  };
```

3. Add receipt UI elements. After the closing `</div>` of the button flex container (after line 115), but before the closing `</section>` tag, add:

```tsx
      {receiptResult && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-sm p-3 text-green-400 text-sm mt-4">
          {receiptResult}
        </div>
      )}

      {status === 'paid' && (
        <div className="flex gap-3 mt-4 pt-4 border-t border-border">
          <button
            onClick={resendReceipt}
            disabled={sendingReceipt}
            className="border border-border text-text-primary font-semibold px-4 py-2 rounded-sm text-sm hover:bg-surface-2 transition-colors disabled:opacity-50"
          >
            {sendingReceipt ? 'Sending...' : 'Resend Receipt'}
          </button>
          <a
            href={`/api/invoices/${invoiceId}/receipt`}
            className="border border-border text-text-primary font-semibold px-4 py-2 rounded-sm text-sm hover:bg-surface-2 transition-colors inline-flex items-center"
          >
            Download Receipt PDF
          </a>
        </div>
      )}
```

- [ ] **Step 2: Verify the build compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/internal/projects/[id]/invoices/[invoiceId]/InvoiceActions.tsx
git commit -m "feat: add resend receipt and download PDF buttons to invoice detail"
```

---

### Task 8: Manual Verification

**Files:** None (testing only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Navigate to a paid invoice**

Go to `/internal/projects/[id]/invoices/[invoiceId]` for any invoice with status "paid." Verify:
- "Resend Receipt" button is visible
- "Download Receipt PDF" link is visible

If no paid invoices exist, mark one as paid using the "Mark Paid" button.

- [ ] **Step 3: Test PDF download**

Click "Download Receipt PDF." Verify the PDF:
- Opens/downloads correctly
- Shows "RECEIPT OF PAYMENT" header with Building NV branding
- Shows green PAID hero block with amount, date, and method
- Shows From / Paid By party info
- Shows Project info
- Shows Financial Summary with correct numbers (original contract, change orders, adjusted total, total paid to date, this payment, remaining balance)
- Shows footer with thank you and contact info

- [ ] **Step 4: Test receipt email (if Resend is configured)**

If `RESEND_API_KEY` is set, click "Resend Receipt." Verify:
- Email arrives with branded layout (PAID badge, amount, table)
- PDF is attached to the email
- PDF filename follows pattern: `{Project Name} — Receipt — {Invoice Number}.pdf`

- [ ] **Step 5: Verify "Mark Paid" triggers receipt**

Find an unpaid invoice, mark it as paid. Check server logs for receipt generation (or check email if Resend is configured). Verify no errors in the console.
