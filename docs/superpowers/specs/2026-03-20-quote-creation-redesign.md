# Quote Creation Redesign — Design Spec

**Date:** 2026-03-20
**Status:** Approved for implementation planning

---

## Problem

The current quote creation flow has three structural problems:

1. **AI is a blocking gate.** You must paste scope text and wait for generation before anything renders. There's no manual path.
2. **Client data is siloed.** Every new quote creates a fresh `Client` record, disconnected from the `Contact`/`Company` records in the pipeline CRM. Repeat clients get duplicate records. Quotes and projects never share a client.
3. **Sequential steps kill context.** The intake → questions → review wizard forces Cody through screens in order. A voice transcript that contains everything still goes through the same blocking flow.

---

## Goal

A single intake surface that accepts any unstructured input (typed scope, pasted RFP, voice transcript), evaluates completeness in real time, renders a live draft with what's known, and surfaces targeted gap questions inline — so Cody reacts and corrects rather than creates from scratch.

---

## Users

- **Cody** — primary operator. Field-oriented, uses AI tools (ChatGPT), not technically savvy. Often working from a fieldy's voice transcript. Needs to produce a quote fast without being blocked by UI process.
- **Danny** — back-office builder. Will use occasionally. Prefers efficiency over hand-holding.

---

## Data Model Changes

### Problem
`Quote` currently links to a `Client` model (id, name, company, email, phone) that is entirely separate from the `Contact` and `Company` models used by the pipeline CRM. Same person, two records, no connection.

### Solution
Introduce `QuoteContact` and `QuoteCompany` junction tables, mirroring the existing `ProjectContact`/`ProjectCompany` pattern (with `role` field). New quotes link directly to the CRM's `Contact` and `Company` records.

**Junction tables use a surrogate `id` (not composite PK).** This deliberately deviates from `ProjectContact`/`ProjectCompany` which use `@@id([projectId, contactId])`. Reason: quote-contact pairs may need their own metadata later (e.g., which contact received the signed PDF). Surrogate key is forward-compatible; composite key is not.

```prisma
model QuoteContact {
  id        String  @id @default(cuid())
  quoteId   String
  quote     Quote   @relation(fields: [quoteId], references: [id])
  contactId String
  contact   Contact @relation(fields: [contactId], references: [id])
  role      String  // "decision_maker" | "site_contact" | "billing_contact"
}

model QuoteCompany {
  id        String  @id @default(cuid())
  quoteId   String
  quote     Quote   @relation(fields: [quoteId], references: [id])
  companyId String
  company   Company @relation(fields: [companyId], references: [id])
  role      String  // "tenant" | "landlord" | "property_manager" | "owner"
}
```

**Back-relations required on existing models:**

```prisma
// Add to Contact model:
quoteContacts  QuoteContact[]

// Add to Company model:
quoteCompanies QuoteCompany[]

// Add to Quote model:
quoteContacts  QuoteContact[]
quoteCompanies QuoteCompany[]
```

### Contact.email constraint
The existing `Contact` model has `email String @unique` (non-nullable). The inline contact create flow must not require email — Cody often has a first name and phone only. **`Contact.email` must become `email String? @unique` (nullable, still unique when present).** This is part of the same migration changeset as the junction tables.

### Migration path
- `Quote.clientId` becomes `String?` (nullable). SQLite ALTER via Prisma migration — straightforward.
- Existing quotes keep their `Client` record. `Client` model is preserved, no data deleted.
- New quotes set `clientId = null` and use `QuoteContact`/`QuoteCompany`.
- **The existing `POST /api/quotes` handler must be rewritten in the same changeset** — it currently does `prisma.client.upsert({ where: { id: body.clientId || "" } })` which will throw once `clientId` is nullable. This is a coupled change, not a follow-up.

---

## Quote Creation Flow

### Input Surface

Single page. One primary input: a large textarea labeled:

> "Paste scope, RFP, or voice transcript — or describe the job"

Below it: a mode toggle with two options:
- **AI Draft** (default) — runs the completeness loop, generates draft
- **Build manually** — skips AI, opens line-item editor directly

### Completeness Loop

When Cody submits input, the system evaluates it against a minimum required set:

| Field | Required | Inferrable from scope? |
|---|---|---|
| Contact name | Yes | Sometimes (if named in RFP) |
| Job site address | Yes | Often (in scope or transcript) |
| Project type | Yes | Usually (inferred from scope) |
| Scope detail (≥1 line item) | Yes | Always parsed from input |
| Contact email or phone | No | No |
| Company / role | No | Sometimes |

**Loop behavior:**
1. AI extracts everything it can from the input
2. Draft renders immediately with what's known — sections, line items, totals
3. Missing required fields surface as **inline callouts** within the draft header area — targeted, specific questions
4. Cody answers inline (type-ahead for existing contacts, free text for new)
5. Each answer resolves its callout; draft updates in place
6. When minimum required set is met, a "Save Quote" button activates

The draft is **editable at all times** — Cody doesn't wait for all gaps to be resolved to start adjusting line items.

### Gap Callouts (UI Detail)

Callouts appear as amber inline prompts at the top of the draft, above the line items:

```
⚠ Who's the contact on this job?  [Search contacts...]  [+ New contact]
⚠ Confirm job site address:  [123 Main St, Reno NV]  [Edit]
```

Each callout is dismissible (skip for now) or resolvable. Required fields that remain unresolved block Save with a clear message — they don't block draft rendering.

**Gap key-to-label mapping lives client-side** as a constant in the new quote page component:

```ts
const GAP_LABELS: Record<string, string> = {
  contact_name: "Who's the contact on this job?",
  address: "Confirm the job site address:",
  project_type: "What type of project is this?",
};
```

The API returns machine-readable gap keys (`"contact_name"`, `"address"`, etc.). The UI resolves them to human-readable prompts via this map. This keeps the API clean and the copy editable without touching the backend.

### AI Generation: Streaming

The `POST /api/quotes/generate` endpoint uses the Anthropic SDK's **streaming** response. Sections stream in as the model generates them — the draft renders progressively rather than waiting for the full response. This makes the perceived latency acceptable regardless of actual generation time (typically 5–15s for a full quote).

The success criterion for speed is: **first line item appears within 3 seconds of submission.** Full draft completion time is outside UX control and is not a hard criterion.

---

## API Changes

### `POST /api/quotes/generate` — updated response shape

Current shape: `{ questions?: string[], sections: Section[] }`
New shape:
```json
{
  "extracted": {
    "contactName": "John Smith",
    "address": "123 Main St, Reno NV",
    "projectType": "Office Buildout"
  },
  "gaps": ["contact_name"],
  "sections": [...]
}
```

**Coupled UI change required:** The existing `src/app/internal/quotes/new/page.tsx` consumes `data.questions` to render the blocking questions screen. That screen is eliminated entirely — `page.tsx` is replaced as part of this changeset. No other consumers of the generate route exist.

### `POST /api/quotes` — rewritten

Accepts:
```json
{
  "address": "...",
  "projectType": "...",
  "projectId": "...",
  "contacts": [{ "contactId": "...", "role": "decision_maker" }],
  "companies": [{ "companyId": "...", "role": "tenant" }],
  "sections": [...]
}
```

No longer accepts `clientName`/`clientCompany`. Sets `clientId = null` on new quotes. Creates `QuoteContact` and `QuoteCompany` records from the `contacts`/`companies` arrays.

### `POST /api/contacts` — **new route**

Fast-create for inline contact creation during quote flow.

Request:
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "email": "john@example.com",
  "phone": "775-555-0000"
}
```

All fields optional except `firstName`. Returns the created `Contact` record. Auth-gated (session required).

### `POST /api/companies` — **new route** (same pattern)

Request: `{ "name": "...", "domain": "..." }` — `name` required.
Returns created `Company`. Auth-gated.

---

## Manual Mode

Selecting "Build manually" skips AI and renders an empty `QuoteEditor` with:
- The same contact/company intake (type-ahead, inline create)
- Address and project type fields
- An empty line-item editor with "Add section" and "Add item" controls

No scope textarea. No AI call.

---

## QuoteEditor Reuse

The existing `src/components/internal/QuoteEditor.tsx` handles line-item editing. It is embedded in the new quote creation page rather than reached via redirect. The "new quote" page and "edit quote" page converge into one experience — creating and editing are the same surface.

---

## Out of Scope

- Voice recording / transcription (Cody's fieldy transcribes; input is already text)
- Invoice layer (separate initiative — QBO integration deferred)
- Migrating existing `Client` records to `Contact` (backwards compat preserved, migration deferred)
- AIA billing / draw schedule (post-revenue feature)

---

## Files Touched

| File | Action |
|---|---|
| `prisma/schema.prisma` | Add `QuoteContact`, `QuoteCompany`; nullable `clientId` and `email`; back-relations |
| `prisma/migrations/` | New migration |
| `src/app/internal/quotes/new/page.tsx` | Full rewrite |
| `src/app/api/quotes/route.ts` | Rewrite POST handler |
| `src/app/api/quotes/generate/route.ts` | Update response shape; add streaming |
| `src/lib/claude.ts` | Update `generateQuoteFromScope` prompt + return type |
| `src/app/api/contacts/route.ts` | New — fast-create contact |
| `src/app/api/companies/route.ts` | New — fast-create company |

---

## Success Criteria

1. First line item streams into the draft within 3 seconds of submission
2. A returning client can be found and linked in 2 keystrokes via type-ahead
3. A new contact can be created inline without leaving the quote creation page — name and phone only, no email required
4. The minimum required set is enforced without blocking the draft from rendering
5. Manual mode produces a usable quote without any AI call
6. New quotes are linked to the correct `Contact` and `Company` records in the CRM — no new orphan `Client` records created
