# Stripe Invoice Payments — Design Spec

**Date:** 2026-03-25
**Status:** Approved

## Overview

Add online payment collection to the existing invoice system via Stripe Checkout. Clients view their passcode-gated invoice and click "Pay Now" to pay by credit card or ACH bank transfer on Stripe's hosted checkout page. Webhooks auto-mark invoices as paid — no manual reconciliation needed.

## Pricing Model

All quotes and invoices include a 4% markup that covers digital payment processing. This markup is applied at the quote/pricing level — by the time a client sees an invoice, the price is the price. The Stripe checkout collects the invoice amount as-is.

A 2% cash discount is available for clients who pay by check. This is handled conversationally (phone/email), not in software. The invoice system does not need to model or display the cash discount.

## Payment Flow

1. Client opens the passcode-gated invoice page (`/invoices/{token}`)
2. After passcode verification, the invoice renders in an iframe with a **"Pay Now"** button below it
3. Client clicks "Pay Now" → hits `POST /api/invoices/{id}/checkout` (authenticated by token+passcode)
4. API creates a Stripe Checkout Session with card + ACH enabled, returns the session URL
5. Client is redirected to Stripe's hosted checkout page
6. Client completes payment (card or ACH bank linking)
7. Stripe redirects client to `/invoices/{token}/success` — a simple confirmation page
8. Stripe fires `checkout.session.completed` webhook → our handler auto-marks the invoice as `paid`
9. If ACH payment fails later, Stripe fires `charge.failed` → handler reverts invoice to `sent`

The "Pay Now" button only appears for invoices in `sent` or `viewed` status. Draft and paid invoices do not show the button.

---

## Data Model

### Modified: `Invoice`

| New Field | Type | Notes |
|---|---|---|
| stripeCheckoutSessionId | String (optional) | Links to the Stripe Checkout Session |
| stripePaymentIntentId | String (optional) | Links to the payment intent for refund/dispute tracking |

### Modified: `paidMethod` values

Expand from `check | ach | other` to:

`check | ach | other | stripe_card | stripe_ach`

No schema change needed — `paidMethod` is already a `String?`. The new values are just conventions.

---

## Routes

### POST `/api/invoices/[id]/checkout`

Creates a Stripe Checkout Session for the invoice. **Public route** — authenticated by `viewToken` + `passcode` (same validation as the HTML serving route, including rate limiting).

**Request body:**

```json
{
  "token": "uuid",
  "passcode": "123456"
}
```

**Stripe Checkout Session configuration:**

- `mode: 'payment'`
- `payment_method_types: ['card', 'us_bank_account']`
- `line_items`: single line item
  - `price_data.currency`: `'usd'`
  - `price_data.product_data.name`: invoice number (e.g., `"Invoice 680G4-2026-03-24-INV-1"`)
  - `price_data.product_data.description`: project name
  - `price_data.unit_amount`: invoice amount in cents (e.g., `2000000` for $20,000.00)
  - `quantity`: `1`
- `success_url`: `{BASE_URL}/invoices/{token}/success`
- `cancel_url`: `{BASE_URL}/invoices/{token}`
- `customer_email`: billing contact's email (pre-fills Stripe form)
- `metadata`: `{ invoiceId, projectId, invoiceNumber }` — used by webhook for reconciliation

**Response:** `{ url: "https://checkout.stripe.com/..." }`

**Guard rails:**
- Invoice must be in `sent` or `viewed` status
- Token + passcode must be valid (same validation as HTML route)
- If a checkout session already exists and hasn't expired, return the existing session URL instead of creating a new one

**Side effect:** Saves `stripeCheckoutSessionId` to the invoice record.

### POST `/api/webhooks/stripe`

Stripe webhook handler. Validates the webhook signature using `STRIPE_WEBHOOK_SECRET`.

**Events handled:**

| Event | Action |
|---|---|
| `checkout.session.completed` | Look up invoice by `metadata.invoiceId`. Set `status: 'paid'`, `paidAt: now()`, `paidMethod` based on payment method type (`stripe_card` or `stripe_ach`). Save `stripePaymentIntentId` from the session's `payment_intent`. |
| `charge.failed` | Look up invoice by matching `stripePaymentIntentId`. If found and status is `paid`, revert to `sent`, clear `paidAt` and `paidMethod`. This handles ACH failures that occur after initial success. |

**Webhook signature validation:** Use `stripe.webhooks.constructEvent()` with the raw request body and `STRIPE_WEBHOOK_SECRET`. Return 400 if signature is invalid.

**Idempotency:** Check if invoice is already `paid` before updating. If already paid, return 200 without changes.

### GET `/invoices/[token]/success`

Simple post-payment success page. Shows a confirmation message with the invoice number and project name. No passcode required — the token is sufficient for this read-only confirmation.

---

## UI Changes

### PasscodeGate component (`src/app/invoices/[token]/PasscodeGate.tsx`)

After successful passcode verification (when `verified` is true), add a "Pay Now" section below the invoice iframe:

```
[Invoice iframe - 80vh]

[Pay Now button]    — only shown for sent/viewed invoices
```

The "Pay Now" button:
- Calls `POST /api/invoices/{invoiceId}/checkout` with `{ token, passcode }`
- On success, redirects the browser to the Stripe Checkout URL (`window.location.href = data.url`)
- Shows loading state while creating the checkout session
- Hidden for `paid` or `draft` invoices

### Success page (`src/app/invoices/[token]/success/page.tsx`)

Minimal confirmation page:
- "Payment Received" heading
- Invoice number and project name
- "Your payment is being processed. You'll receive a confirmation once it's complete."
- Link back to the invoice view

Uses the same neutral gray styling as the public invoice/contract pages (not the internal dark theme).

---

## Invoice HTML Template

No changes. The "Pay Now" button lives on the web page wrapper (PasscodeGate component), not inside the HTML/PDF document. The Payment Instructions section (bank name, routing, account) stays as-is for clients who prefer manual wire/check payment outside the system.

---

## Environment Variables

| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature validation secret |

`STRIPE_PUBLISHABLE_KEY` is not needed — Stripe Checkout hosted sessions don't require client-side Stripe.js.

---

## Webhook Setup

The Stripe webhook endpoint must be registered in the Stripe Dashboard (or via CLI for local dev):

- **Endpoint URL:** `{BASE_URL}/api/webhooks/stripe`
- **Events:** `checkout.session.completed`, `charge.failed`

For local development, use `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

---

## Out of Scope

- Cash discount modeling in the invoice system (handled conversationally)
- Partial payments or payment plans through Stripe
- Stripe Connect / marketplace model (CPP is the sole merchant)
- Automatic payment reminders through Stripe
- Stripe invoicing product (we have our own invoice system)
- Refunds through the UI (handle in Stripe Dashboard if needed)
