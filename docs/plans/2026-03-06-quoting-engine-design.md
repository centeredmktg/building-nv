# Quoting Engine Design

## Overview

An internal quoting tool built into the same Next.js codebase as the Building NV marketing site. Estimators ingest a scope of work (PDF or free text), Claude AI generates a structured, editable quote with line-item descriptions and pricing, and the final proposal is delivered to the client as a shareable, printable HTML page with an acceptance button.

## Goals

- Eliminate manual quote assembly — AI drafts, human refines
- Force scope clarity upstream — AI asks questions rather than guessing
- Produce professional, branded proposals clients can accept online
- Build institutional pricing knowledge over time
- Design for delegation — you run it now, estimators run it later

## Non-Goals (for now)

- Full CRM (contacts, pipeline tracking) — data model is designed to support this later
- DocuSign-grade e-signature — simple timestamped acceptance first, upgrade later
- External integrations (accounting, scheduling)

## Architecture

Protected section of the existing Next.js app at `/app/(internal)/`. Same design system (black/gold/grey) as the marketing site. Completely separate routes — no shared UI with the public site.

**Three modules:**
1. **Intake** — scope ingestion + Claude-powered clarifying questions + quote generation
2. **Quote Editor** — structured line-item editor with live pricing calculations
3. **Proposal Output** — public shareable page with print-perfect layout and acceptance block

## Tech Stack

- **Framework:** Next.js 14+ App Router (same repo as marketing site)
- **Auth:** NextAuth.js with credentials provider (simple password for now)
- **Database:** SQLite via Prisma (swap to Postgres later with one config change)
- **AI:** Anthropic Claude API (claude-sonnet-4-6) via `@anthropic-ai/sdk`
- **Styling:** Tailwind CSS (same design tokens as marketing site)
- **PDF:** None — HTML page with `@media print` CSS handles print-to-PDF

## Data Model

```
clients
  id, name, company, email, phone, created_at

quotes
  id, client_id, slug, title, address, project_type
  status (draft | sent | accepted)
  materials_markup_pct (default 10)
  overhead_pct (default 10)
  profit_pct (default 10)
  payment_terms, exclusions, notes
  created_at, updated_at, sent_at

line_item_sections
  id, quote_id, title, position

line_items
  id, section_id, description, quantity, unit, unit_price
  is_materials (bool — applies markup)
  position

acceptances
  id, quote_id, signer_name, accepted_at, ip_address
```

Designed so `contacts`, `projects`, and CRM pipeline features bolt on later without schema breakage.

## Module 1: Intake

**Route:** `/internal/quotes/new`

**Inputs:**
- Client name, property address, project type (dropdown)
- Scope: free-text field OR PDF upload (extracted server-side)
- "Generate Quote" button

**AI Behavior:**
- Claude parses the scope and either:
  - Returns a structured quote draft (sections + line items with descriptions, quantities, unit prices)
  - OR surfaces 1–3 clarifying questions it needs answered before it can price deterministically (e.g. "What is the square footage of Unit 3 office?", "Are permits required?")
- Estimator answers questions, then generates
- No guessing — forces better scope documentation upstream

**Claude prompt strategy:**
- System prompt includes: Reno NV market context, Building NV's work types, pricing guidance, output schema
- Output is structured JSON: `{ sections: [{ title, items: [{ description, qty, unit, unit_price }] }], questions: [] }`
- If `questions` is non-empty, show them before generating line items

## Module 2: Quote Editor

**Route:** `/internal/quotes/[id]/edit`

**Layout:** Three-panel

**Left — Scope Reference:**
- Read-only view of the original scope input
- Client/project metadata fields (editable)

**Center — Line Item Editor:**
- Sections displayed as collapsible groups
- Each line item row: `description` (text) | `qty` (number) | `unit` (select: ea, SF, LF, LS, hr) | `unit_price` ($) | `line_total` (calculated)
- Add / remove / reorder line items within sections
- Add / remove / reorder sections
- All AI-generated values pre-filled and fully editable
- Materials items flagged with markup indicator

**Right — Summary Panel:**
- Subtotal (sum of all line items)
- Materials markup % (default 10%, editable)
- Overhead % (default 10%, editable)
- Profit % (default 10%, editable)
- **Total** — recalculates live
- "Preview Proposal" → opens `/proposals/[slug]` in new tab
- "Send to Client" → copies shareable link to clipboard, marks quote as `sent`

## Module 3: Proposal Output

**Route:** `/proposals/[slug]`

**Slug format:** `YYYY-MM-DD-[client-slug]-[address-slug]`
Example: `/proposals/2026-03-06-hallmark-freeport-units-1-8`

**Page structure:**
1. Building NV wordmark + "Proposal" header
2. Proposal date, client name, job site address
3. Line items by section (same hierarchy as editor)
4. Materials subtotal with markup shown
5. Overhead line (% of subtotal)
6. Profit line (% of subtotal)
7. **Total** (prominent)
8. Payment terms
9. Exclusions
10. Terms & Conditions (Building NV boilerplate)
11. Acceptance block

**Acceptance block:**
- Input: signer name
- Button: "I Accept This Proposal"
- On submit: records `{ signer_name, accepted_at, ip_address }` → marks quote `accepted`
- Page reloads showing confirmation state (locked, timestamp displayed)
- If already accepted: shows accepted state on load

**Print behavior (`@media print`):**
- Hide: nav, acceptance button, internal UI chrome
- Show: clean proposal layout only
- Result: client prints to PDF or browser prints directly

## Auth

**Route group:** `/app/(internal)/` — all routes under this group require auth

**Provider:** NextAuth credentials (username + password stored in env)
- Single shared password for now
- Upgrade path: add per-user accounts when team grows

**Middleware:** Redirect unauthenticated requests to `/internal/login`

## Pricing Logic

```
line_total = qty × unit_price
subtotal = sum(all line_totals)
materials_subtotal = sum(line_totals where is_materials = true)
materials_markup_amount = materials_subtotal × materials_markup_pct / 100
overhead_amount = subtotal × overhead_pct / 100
profit_amount = subtotal × profit_pct / 100
total = subtotal + materials_markup_amount + overhead_amount + profit_amount
```

All percentages default to 10% and are adjustable per quote at any time before sending.

## Future CRM Layer

The data model is intentionally designed for this. When ready:
- Add `contacts` table (rename/extend `clients`)
- Add `projects` table (group multiple quotes)
- Add `status` pipeline (lead → quoted → accepted → in progress → complete)
- Add quote history per contact
- Add notes/activity log per project

No schema migration pain — it's additive.

## Future: Digital Signature Upgrade

Replace the acceptance block with a proper e-signature flow:
- Option A: Build it (canvas signature capture, stored as image)
- Option B: Integrate Docusign or HelloSign API
- The acceptance data model (`acceptances` table) is already in place — the upgrade is UI-only
