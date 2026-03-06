# Lead CRM Design — Building NV

## Goal

Connect the contact form to a real backend: store leads in Postgres, notify the bids team by email, and provide a simple kanban CRM for tracking bids through the pipeline.

## Stack

- **Database:** Supabase (hosted Postgres, free tier)
- **File storage:** Supabase Storage (S3-compatible, free tier)
- **Email:** Resend (transactional email, free tier)
- **Admin UI:** Next.js `/admin` route in the existing app
- **Drag-and-drop:** dnd-kit

---

## Data Model

### `leads` table

| column | type | notes |
|---|---|---|
| `id` | uuid | primary key, default gen_random_uuid() |
| `name` | text | required |
| `company` | text | nullable |
| `phone` | text | required |
| `project_type` | text | nullable |
| `message` | text | nullable |
| `stage` | text | enum, default 'opportunity_identified' |
| `notes` | text | internal notes, nullable |
| `attachment_url` | text | Supabase Storage URL, nullable |
| `created_at` | timestamptz | default now() |
| `updated_at` | timestamptz | updated via trigger |

### Stages (ordered)

1. `opportunity_identified`
2. `quote_requested`
3. `bid_delivered`
4. `contract_completed`
5. `contract_sent`
6. `contract_signed`
7. `closed_lost`

### Supabase Storage

- Bucket: `lead-attachments`
- Files stored as `{lead_id}/{filename}`
- Public read URLs stored in `attachment_url`

---

## API Routes

| route | method | description |
|---|---|---|
| `/api/contact` | POST | Save lead to DB, upload attachment to Storage, send email via Resend |
| `/api/leads` | GET | Return all leads, ordered by created_at desc (admin only) |
| `/api/leads/[id]` | PATCH | Update stage or notes (admin only) |

Admin routes protected by middleware checking `Authorization` header against `ADMIN_PASSWORD` env var.

---

## Contact Form Changes

- Add optional file upload field: "Attach existing bid or plans (optional)"
- Accepted types: PDF, JPG, PNG, DOC, DOCX
- Max size: 10MB
- On submit: upload file to Supabase Storage first, then POST lead data + attachment URL to `/api/contact`

---

## Email (Resend)

Sent to `bids@buildingnv.com` on every form submission.

- **Subject:** `New Lead: {name} — {project_type}`
- **Body:** All form fields (name, company, phone, project type, message)
- **Attachment link:** If present, include a labeled download link to the Supabase Storage URL

---

## Admin UI — `/admin`

### Auth

Simple middleware: checks for a session cookie set by a login form. Login form at `/admin/login` accepts `ADMIN_PASSWORD` env var. No auth library — just a signed cookie via `jose`.

### Kanban Board

- 7 columns, one per stage
- Horizontal scroll on smaller screens
- Cards show: name, company, project type, phone, created date
- Drag-and-drop via dnd-kit to move cards between stages (calls `PATCH /api/leads/[id]`)

### Lead Detail Panel

- Slide-out panel on card click
- Shows all lead fields
- Editable notes textarea (auto-saves on blur)
- Attachment download link if present

### Header

- "X open bids" — count of leads not in `contract_signed` or `closed_lost`

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
ADMIN_PASSWORD=
```

---

## Out of Scope (for now)

- Bid dollar value tracking
- Email threading / reply tracking
- Multi-user admin with roles
- Mobile-optimized kanban
