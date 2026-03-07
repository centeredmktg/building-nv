# Lead CRM Design — Building NV

## Goal

Connect the contact form to a real backend: store projects in Postgres with linked contacts and companies, notify the bids team by email, and provide a simple kanban CRM for tracking projects through the pipeline.

## Core Concept

**Project is the central object.** "Lead" is not a separate object — it is a stage. A project starts as an opportunity and accumulates data as it moves through the pipeline. There is no structural difference between an early-stage opportunity and a signed contract.

## Stack

- **Database:** Supabase (hosted Postgres, free tier)
- **File storage:** Supabase Storage (S3-compatible, free tier)
- **Email:** Resend (transactional email, free tier)
- **Admin UI:** Next.js `/admin` route in the existing app
- **Drag-and-drop:** dnd-kit

---

## Data Model

### `companies`

| column | type | notes |
|---|---|---|
| `id` | uuid | PK, gen_random_uuid() |
| `name` | text | |
| `type` | text | customer, real_estate_agency, property_manager, subcontractor, supplier |
| `domain` | text | unique — dedupe key (null for consumer domains) |
| `phone` | text | nullable |
| `created_at` | timestamptz | default now() |

### `contacts`

| column | type | notes |
|---|---|---|
| `id` | uuid | PK, gen_random_uuid() |
| `first_name` | text | |
| `last_name` | text | nullable |
| `email` | text | unique — dedupe key |
| `phone` | text | nullable |
| `type` | text | employee, subcontractor, customer, real_estate_agent, property_manager, supplier |
| `primary_company_id` | uuid | FK → companies, nullable |
| `created_at` | timestamptz | default now() |

### `projects`

| column | type | notes |
|---|---|---|
| `id` | uuid | PK, gen_random_uuid() |
| `name` | text | auto-generated on inbound, editable |
| `stage` | text | see pipeline stages below |
| `project_type` | text | nullable |
| `message` | text | nullable |
| `notes` | text | nullable |
| `attachment_url` | text | nullable |
| `created_at` | timestamptz | default now() |
| `updated_at` | timestamptz | auto-updated via trigger |

### `project_contacts` (join)

| column | type | notes |
|---|---|---|
| `project_id` | uuid | FK → projects |
| `contact_id` | uuid | FK → contacts |
| `role` | text | customer, property_manager, subcontractor, etc. |

PK: `(project_id, contact_id)`

### `project_companies` (join)

| column | type | notes |
|---|---|---|
| `project_id` | uuid | FK → projects |
| `company_id` | uuid | FK → companies |
| `role` | text | customer, property_manager, subcontractor, etc. |

PK: `(project_id, company_id)`

---

## Pipeline Stages (ordered)

1. `opportunity_identified`
2. `quote_requested`
3. `bid_delivered`
4. `contract_completed`
5. `contract_sent`
6. `contract_signed`
7. `closed_lost`

---

## Supabase Storage

- Bucket: `project-attachments`
- Files stored as `{project_id}/{filename}`
- Public read URLs stored in `projects.attachment_url`

---

## Inbound Form Submission Logic

When a form is submitted from the marketing site:

1. **Parse email domain** — extract domain from contact's email
2. **Consumer domain exclusion** — if domain is in the exclusion list (gmail.com, outlook.com, hotmail.com, yahoo.com, icloud.com, me.com, aol.com), do NOT create or match a company from it
3. **Upsert company** — if domain is business domain, find or create company by domain; use form's company name if creating
4. **Upsert contact** — find or create contact by email; link to company if one was resolved
5. **Upload attachment** — if file present, upload to Supabase Storage
6. **Create project** — new project record with stage `opportunity_identified`
7. **Link via join tables** — `project_contacts` and `project_companies` with role `customer`
8. **Send email** — notify `bids@buildingnv.com` via Resend

---

## Contact Form Fields

- Name (full name, split into first/last on save)
- Email * (new — needed for contact deduplication)
- Company name
- Phone *
- Project type
- Message
- Attachment (optional — PDF, JPG, PNG, DOC, DOCX, max 10MB)

---

## Email Notification (Resend)

Sent to `bids@buildingnv.com` on every form submission.

- **Subject:** `New Project: {name} — {project_type}`
- **Body:** All form fields
- **Attachment link:** download URL if present

---

## Admin UI — `/admin`

### Auth

Middleware checks for a signed JWT cookie (`jose`). Login at `/admin/login` validates against `ADMIN_PASSWORD` env var.

### Kanban Board

- 7 columns, one per stage
- Horizontal scroll
- Cards show: contact name, company, project type, phone, date
- Drag-and-drop via dnd-kit → `PATCH /api/projects/[id]`

### Project Detail Panel

- Slide-out on card click
- All project fields
- Linked contacts and companies with roles
- Editable notes (auto-saves on blur)
- Attachment download link if present

### Header

- Count of open projects (not `contract_signed` or `closed_lost`)

---

## API Routes

| route | method | description |
|---|---|---|
| `POST /api/contact` | POST | Full inbound submission: upsert contact + company, create project, send email |
| `GET /api/projects` | GET | All projects with linked contacts/companies (admin) |
| `PATCH /api/projects/[id]` | PATCH | Update stage or notes (admin) |

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
ADMIN_PASSWORD=
ADMIN_JWT_SECRET=
```

---

## Out of Scope (for now)

- Property/building object (PM attached directly to project as contact)
- Bid dollar value tracking
- Multi-user admin with roles
- Mobile-optimized kanban
- GTM mapping of PM companies to buildings (future biz dev project)
