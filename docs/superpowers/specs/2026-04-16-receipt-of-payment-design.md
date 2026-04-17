# Receipt of Payment — Design Spec

**Date:** 2026-04-16
**Status:** Approved

## Purpose

Generate and deliver a styled, branded receipt of payment to customers when an invoice is paid. The receipt serves as both a payment confirmation and a financial status update — answering "how much have I paid, how much do I owe, and what did I agree to."

## Delivery

- **Branded HTML email** with payment confirmation details
- **PDF attachment** on that same email, for the customer to file
- **Auto-sends** on any payment event — Stripe webhook or manual "Mark Paid"
- **"Resend Receipt" button** on the internal invoice detail page for any paid invoice

## Receipt Document Structure

### Header

- Title: "RECEIPT OF PAYMENT" (same position as "INVOICE" on invoice template)
- Building NV branding: company name, license #, address
- Receipt metadata on the right: invoice number, payment date

### Payment Confirmation (hero block)

- Visual "PAID" indicator (green background, clear status)
- Amount paid (large, prominent)
- Date paid
- Payment method (Check, ACH, Credit Card, ACH Bank Transfer)

### Parties

Two-column layout matching invoice template:
- **From:** Building NV (contractor name, email, phone)
- **Paid By:** Billing contact name, company name if applicable

### Project Reference

- Project name, type, site address

### Project Financial Summary

This is the key section that grounds the customer:
- Original contract amount
- Change orders (count + total)
- Adjusted contract total
- **Total paid to date** (sum of all paid invoices including this one)
- **This payment** (highlighted)
- **Remaining balance**

Note: This differs from the invoice template's summary. The invoice shows "previously invoiced / this invoice / remaining." The receipt shows "total paid to date / this payment / remaining" — a payment-centric view rather than a billing-centric view.

### Footer

- "Thank you for your business."
- "Please retain this receipt for your records."
- Contact info for questions

## Email Design

Upgrade the existing `buildPaymentReceiptEmail` from plain inline HTML to a branded email that matches Building NV's visual identity. The email body is a lighter version of the PDF — payment confirmation, amount, date, method, and a note that the PDF is attached for their records. Not a full financial summary (that's in the PDF).

## Technical Approach

### New Files

- `src/lib/docs/receipt-template.ts` — `renderReceiptHtml(data: ReceiptTemplateData): string`
  - Follows same pattern as `invoice-template.ts`
  - Same styling conventions: system fonts, same color palette, same spacing
  - Same utility functions: `esc()`, `fmtCurrency()`, `fmtDate()`

### Modified Files

- `src/lib/docs/email.ts`
  - Replace `buildPaymentReceiptEmail` with branded version
  - Update `sendPaymentReceipt` to accept a PDF buffer and attach it
- `src/lib/docs/pdf.ts`
  - No changes needed — existing `generatePDF()` handles receipt HTML the same as invoice HTML
- `src/app/api/invoices/[id]/route.ts` (PATCH)
  - After marking paid: generate receipt HTML, generate PDF, send receipt email with PDF attached
  - Matches what the Stripe webhook already does (receipt on payment)
- `src/app/api/webhooks/stripe/route.ts`
  - Update to use new receipt template + PDF attachment flow
- `src/app/api/invoices/[id]/receipt/route.ts` (new)
  - `POST` — resend receipt for a paid invoice
  - `GET` — download receipt PDF for a paid invoice
- `src/app/internal/projects/[id]/invoices/[invoiceId]/InvoiceActions.tsx`
  - Add "Resend Receipt" button (visible when status is "paid")
  - Add "Download Receipt" link (visible when status is "paid")

### Data Requirements

The receipt template needs data that spans beyond a single invoice. Specifically, "total paid to date" requires querying all paid invoices for the same project. This is a simple aggregation:

```sql
SELECT SUM(amount) FROM invoices
WHERE project_id = ? AND status = 'paid'
```

### Receipt Generation Flow

Shared helper function used by both the Stripe webhook and the PATCH route:

```
generateAndSendReceipt(invoiceId) →
  1. Fetch invoice with relations (project, billing contact, contract, milestones)
  2. Fetch all paid invoices for project (for "total paid to date")
  3. Render receipt HTML via receipt-template.ts
  4. Generate PDF via existing generatePDF()
  5. Send branded email with PDF attached via updated sendPaymentReceipt()
```

This avoids duplicating receipt logic between the webhook and PATCH route.

### Receipt Storage

Receipts are generated on-demand, not persisted. Unlike invoices (which have `htmlPath` for the canonical billing document), receipts are transient — they're generated when sent and can be regenerated for resend. The financial summary is always computed from current data, so a re-sent receipt reflects the latest state.

## Out of Scope

- Receipt numbering (receipts reference the invoice number, no separate sequence)
- Receipt history/audit log (the email delivery is the record)
- Customizable receipt templates
- Batch receipt generation
