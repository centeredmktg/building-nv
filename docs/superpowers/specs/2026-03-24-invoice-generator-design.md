# Invoice Generator — Design Spec

**Date:** 2026-03-24
**Status:** Approved

## Overview

A milestone-driven invoice engine for Building NV that generates stylized HTML invoices, persists them as immutable artifacts, and provides token+passcode-protected public access. Every invoice traces back to a scope document (contract milestone or change order) — no orphan payments.

The invoice doubles as a mini project status report: current billing, full project financial summary, and a milestone schedule showing what's been paid, what's due now, and what's coming.

## Core Principle

Every deposit pairs with an invoice, every invoice pairs with a project, every invoice traces to an authorized scope (contract or change order). This is the audit trail.

---

## Data Model

### New: `Invoice`

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| invoiceNumber | String (unique) | e.g., `680G4-2026-03-24-INV-1` |
| sequenceNumber | Int | Auto-increment per project |
| projectId | String (FK) | Required — every invoice belongs to a project |
| contractId | String (FK) | Required — the scope authorization |
| changeOrderId | String (FK, optional) | If billing for a CO |
| billingContactId | String (FK) | The person paying |
| billingCompanyId | String (FK, optional) | The entity (if applicable) |
| amount | Float | Sum of milestone billing amounts (editable with note) |
| amountAdjustmentNote | String (optional) | Required if amount differs from milestone sum |
| issueDate | DateTime | Defaults to today |
| dueDate | DateTime | Defaults to net-30 from contract payment terms |
| notes | String (optional) | Project note for multi-phase context |
| status | String | `draft` → `sent` → `viewed` → `paid` (matches codebase convention — no Prisma enums) |
| htmlPath | String | Path to persisted HTML artifact |
| viewToken | String (unique, optional) | UUID for public access |
| passcode | String (optional) | 6-digit auto-generated code |
| sentAt | DateTime (optional) | When emailed to billing contact |
| viewedAt | DateTime (optional) | First public view timestamp |
| paidAt | DateTime (optional) | When marked paid |
| paidMethod | String (optional) | `check`, `ach`, `other` |
| createdAt | DateTime | Auto |
| updatedAt | DateTime | Auto |

**Relations:**
- `project` → Project
- `contract` → Contract
- `changeOrder` → ChangeOrder (optional)
- `billingContact` → Contact
- `billingCompany` → Company (optional)
- `invoiceMilestones` → InvoiceMilestone[]

### New: `InvoiceMilestone` (junction table)

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| invoiceId | String (FK) | |
| milestoneId | String (FK) | |

**Unique constraints:**
- `(invoiceId, milestoneId)` — prevents duplicate links on the same invoice
- `milestoneId` is globally unique — prevents a milestone from being billed on multiple invoices

This junction prevents double-billing a milestone — each milestone can only appear on one invoice across the entire system.

### Modified: `Milestone`

| New Field | Type | Notes |
|---|---|---|
| billingAmount | Float (optional) | What this milestone is worth in dollars |

This lets the milestone schedule double as the billing schedule. Set at contract signing alongside the milestone plan.

### Modified: `Project`

Add reverse relation: `invoices Invoice[]`

### Modified: `Contract`

Add reverse relation: `invoices Invoice[]`

### Modified: `Contact`

Add reverse relation: `invoices Invoice[]` (as billingContact)

### Modified: `Company`

Add reverse relation: `invoices Invoice[]` (as billingCompany)

### Modified: `ChangeOrder`

Add reverse relation: `invoices Invoice[]`

---

## Invoice Numbering

Format: `{shortCode}-{YYYY-MM-DD}-INV-{n}`

- `shortCode` is a new `String?` field on `Project` (e.g., `680G4`). Migration backfills existing projects.
- `n` is the `sequenceNumber`, auto-incremented per project
- Example: `680G4-2026-03-24-INV-1`, `680G4-2026-03-24-INV-2`

### Modified: `Project` (shortCode)

Add `shortCode String?` — a short human-readable project identifier used in invoice numbering and other document references. Set when the project is created or during quote-to-contract conversion.

---

## Invoice HTML Template

File: `src/lib/docs/invoice-template.ts` (follows existing template convention, uses `import 'server-only'`)

Function: `renderInvoiceHtml(invoice: InvoiceWithRelations): string`

### Layout

**1. Header**
- "INVOICE" prominent, right-aligned invoice number
- CPP Painting & Building branding, address, phone, license number
- Issue date and due date in a clean info block

**2. Billing parties — two columns**
- Left: Contractor representative (name, email, phone)
- Right: Billing party (contact name, company name if applicable)

**3. Project info**
- Project name, type, site address

**4. Current billing section**
- Table of milestone(s) being billed: name, description, amount
- If change order, reference CO number and scope description
- Section subtotal → invoice total

**5. Project note**
- Free text for context (e.g., "Phase 2 — Kitchen renovation")
- Only rendered if present

**6. Project financial summary**
- Original contract amount
- Change orders to date (count and total, if any)
- Adjusted contract total
- Previously invoiced (sum of all prior paid/sent invoices)
- **This invoice** (highlighted)
- **Remaining balance**

**7. Milestone schedule**
- Table: milestone name, planned date, billing amount, status
- Completed milestones: ✓ with completion date
- Current (being billed): highlighted row
- Upcoming: estimated dates shown
- Final milestone labeled as retainage release (5%)

**8. Payment instructions**
- Bank: Western Alliance Bank
- Routing and account numbers
- Contact for questions: Danny Cox, phone, email

### Design Direction

Clean, professional, confident. Not a Google Sheets export — a document you'd be proud to send to a property manager or landlord. Good typography, intentional whitespace, subtle color accents consistent with Building NV branding. The financial summary and milestone schedule should be the visual anchors.

### Persistence

HTML artifact saved to `{DOCS_DIR}/{invoiceId}-invoice.html`. This is the immutable record — the permalink stored on the invoice record as `htmlPath`.

---

## Routes

### Internal (authenticated)

| Route | Purpose |
|---|---|
| `/internal/projects/[id]/invoices` | List all invoices for a project |
| `/internal/projects/[id]/invoices/new` | Create invoice |
| `/internal/projects/[id]/invoices/[invoiceId]` | View invoice detail, send, mark paid |

### API

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/projects/[id]/invoices` | Create invoice, render HTML, save artifact |
| PATCH | `/api/invoices/[id]` | Update status (mark paid, update notes) |
| POST | `/api/invoices/[id]/send` | Generate token + passcode, email link |
| GET | `/api/invoices/[id]/html` | Serve persisted HTML (token + passcode validated) |

### Public

| Route | Purpose |
|---|---|
| `/invoices/[token]` | Passcode gate → renders invoice HTML |

---

## Invoice Creation Flow

1. **Select billing basis** — UI shows unbilled milestones from the contract. Check which ones to bill. Their `billingAmount` values auto-populate the invoice amount. For change order billing, select the CO.
2. **Confirm billing party** — defaults by traversing Project → Contract → Quote → QuoteContacts (looks for `billing_contact` role, falls back to `decision_maker`, then first contact) + QuoteCompanies (first company). Overridable per invoice.
3. **Set dates** — issue date (default: today), due date (default: net-30 from contract payment terms).
4. **Project note** — optional free text.
5. **Preview** — full HTML render for review before saving.
6. **Save** — persist record, render and save HTML artifact, mark milestones as billed via junction table.

### Guard Rails

- Cannot bill a milestone already linked to an invoice (junction uniqueness)
- Cannot create an invoice without at least one milestone or change order selected
- Invoice amount defaults to sum of selected milestone billing amounts
- If amount is edited, `amountAdjustmentNote` is required explaining the variance

---

## Send Flow

1. System generates a UUID `viewToken` and a random 6-digit `passcode`
2. Email sent to billing contact via Resend with the invoice link (`/invoices/{token}`)
3. Passcode shared separately out-of-band (text, call, etc.)
4. Invoice status updated to `sent`, `sentAt` timestamped
5. First view through public route stamps `viewedAt`, status → `viewed`

### Invoice Email

New email builder function in `src/lib/docs/email.ts`: `buildInvoiceEmail()`. Distinct from the existing signing-flow emails — CTA is "View Invoice" not "Review & Sign". Includes invoice number, amount, due date, and project name in the email body.

---

## Public Viewing

Route: `/invoices/[token]`

1. Look up invoice by `viewToken`
2. Present passcode input form
3. On correct passcode, render invoice HTML in iframe (fetched from `/api/invoices/[id]/html?token={token}&passcode={passcode}`)
4. Stamp `viewedAt` on first successful view

### Passcode Security

Rate limit passcode attempts: max 5 failed attempts per token per 15 minutes (enforced at the API route level). After lockout, the page shows a "contact us" message. This prevents brute-force on the 6-digit code.

---

## Integration Points

### JobCard
- Add invoice progress indicator: "3 of 5 milestones billed" or "$42,390 / $65,000 invoiced"

### FinancialSummarySection
- Wire "Uninvoiced" field to real calculation: `contractAmount - sum(sent/viewed/paid invoices)`
- Data flow: server page (`/internal/projects/[id]/page.tsx`) queries invoice totals and passes as props to the client component

### Project Detail Page
- New "Invoices" section showing invoice list with status badges (draft/sent/viewed/paid)
- Each row: invoice number, date, amount, billing party, status

### Milestone Section
- Billed milestones show the linked invoice reference
- Upcoming milestones display their `billingAmount`
- Update `Milestone` interface in `src/lib/crmTypes.ts` to include `billingAmount`

### API Route Nesting Note
Invoice creation is nested under projects (`/api/projects/[id]/invoices`). Subsequent operations (PATCH, send, html) use top-level routes (`/api/invoices/[id]`) since the invoice ID is sufficient context. This matches the mixed pattern already in the codebase (milestones nested, contracts top-level).

---

## PDF Generation

Uses existing Puppeteer pipeline (`src/lib/docs/pdf.ts`). The existing `generateSignedPDF()` injects a signature block — invoices need a simpler `generatePDF()` variant (HTML → PDF, no signature injection). PDF generated on demand from the persisted HTML for download or email attachment. Not generated at creation time — the HTML artifact is the source of truth.

---

## Out of Scope (for now)

- QuickBooks Online integration (manual mirror for now, future API integration when moving to QBO)
- Online payment (Stripe/ACH) through the invoice link
- Automated payment reminders
- Retainage as a separate financial concept (handled as the final milestone)
- Batch invoicing across multiple projects
