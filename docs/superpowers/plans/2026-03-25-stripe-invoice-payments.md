# Stripe Invoice Payments — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Stripe Checkout-based online payment (card + ACH) to the existing invoice system, with webhooks that auto-mark invoices as paid.

**Architecture:** A new `/api/invoices/[id]/checkout` route creates Stripe Checkout Sessions authenticated by the existing token+passcode mechanism. Stripe's hosted checkout collects payment. A `/api/webhooks/stripe` endpoint receives `checkout.session.completed` and `charge.failed` events to auto-update invoice status. The existing `PasscodeGate` component gets a "Pay Now" button. Two new Prisma fields track Stripe IDs for reconciliation.

**Tech Stack:** Stripe Node SDK (`stripe`), Next.js App Router, Prisma (PostgreSQL)

**Spec:** `docs/superpowers/specs/2026-03-25-stripe-invoice-payments-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `prisma/schema.prisma` | Modify | Add `stripeCheckoutSessionId` and `stripePaymentIntentId` to Invoice |
| `src/lib/stripe.ts` | Create | Stripe client singleton |
| `src/app/api/invoices/[id]/checkout/route.ts` | Create | POST — create Stripe Checkout Session |
| `src/app/api/webhooks/stripe/route.ts` | Create | POST — Stripe webhook handler |
| `src/app/invoices/[token]/PasscodeGate.tsx` | Modify | Add "Pay Now" button after passcode verification |
| `src/app/invoices/[token]/page.tsx` | Modify | Pass invoice status to PasscodeGate |
| `src/app/invoices/[token]/success/page.tsx` | Create | Post-payment success page |

---

### Task 1: Install Stripe SDK and Add Schema Fields

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/lib/stripe.ts`

- [ ] **Step 1: Install the Stripe SDK**

```bash
npm install stripe
```

- [ ] **Step 2: Create the Stripe client singleton**

```typescript
// src/lib/stripe.ts
import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY not set');
    _stripe = new Stripe(key, { apiVersion: '2025-04-30.basil' });
  }
  return _stripe;
}
```

- [ ] **Step 3: Add Stripe fields to Invoice model**

In `prisma/schema.prisma`, add two fields to the `Invoice` model after `paidMethod` (line 184):

```prisma
  stripeCheckoutSessionId String?
  stripePaymentIntentId   String?
```

- [ ] **Step 4: Run migration**

```bash
npx prisma migrate dev --name add-stripe-fields-to-invoice
```

- [ ] **Step 5: Regenerate Prisma client and stage generated files**

```bash
npx prisma generate
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json prisma/schema.prisma prisma/migrations/ src/generated/ src/lib/stripe.ts
git commit -m "feat: install Stripe SDK and add checkout/payment intent fields to Invoice"
```

---

### Task 2: Checkout Session API Route

**Files:**
- Create: `src/app/api/invoices/[id]/checkout/route.ts`

- [ ] **Step 1: Create the checkout route**

```typescript
// src/app/api/invoices/[id]/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';

const BASE_URL = () => process.env.NEXT_PUBLIC_BASE_URL ?? 'https://buildingnv.us';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: { token?: string; passcode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.token || !body.passcode) {
    return NextResponse.json({ error: 'Missing token or passcode' }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { project: true, billingContact: true },
  });

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  // Validate token
  if (body.token !== invoice.viewToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check rate limit
  if (invoice.passcodeLockedUntil && new Date() < invoice.passcodeLockedUntil) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  // Validate passcode
  if (body.passcode !== invoice.passcode) {
    const newFailures = invoice.passcodeFailures + 1;
    const lockout = newFailures >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
    await prisma.invoice.update({
      where: { id },
      data: { passcodeFailures: newFailures, passcodeLockedUntil: lockout },
    });
    return NextResponse.json({ error: 'Invalid passcode' }, { status: 403 });
  }

  // Only allow checkout for sent or viewed invoices
  if (invoice.status !== 'sent' && invoice.status !== 'viewed') {
    return NextResponse.json(
      { error: `Cannot pay invoice in status: ${invoice.status}` },
      { status: 422 },
    );
  }

  // If we already have an unexpired checkout session, return it
  if (invoice.stripeCheckoutSessionId) {
    try {
      const stripe = getStripe();
      const existing = await stripe.checkout.sessions.retrieve(invoice.stripeCheckoutSessionId);
      if (existing.status === 'open' && existing.url) {
        return NextResponse.json({ url: existing.url });
      }
    } catch {
      // Session expired or invalid — create a new one
    }
  }

  // Create a new Stripe Checkout Session
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card', 'us_bank_account'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Invoice ${invoice.invoiceNumber}`,
            description: invoice.project.name,
          },
          unit_amount: Math.round(invoice.amount * 100), // cents
        },
        quantity: 1,
      },
    ],
    customer_email: invoice.billingContact.email ?? undefined,
    success_url: `${BASE_URL()}/invoices/${invoice.viewToken}/success`,
    cancel_url: `${BASE_URL()}/invoices/${invoice.viewToken}`,
    metadata: {
      invoiceId: invoice.id,
      projectId: invoice.projectId,
      invoiceNumber: invoice.invoiceNumber,
    },
  });

  // Save session ID to invoice
  await prisma.invoice.update({
    where: { id },
    data: { stripeCheckoutSessionId: session.id },
  });

  return NextResponse.json({ url: session.url });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/invoices/[id]/checkout/route.ts
git commit -m "feat: Stripe Checkout Session creation API route"
```

---

### Task 3: Stripe Webhook Handler

**Files:**
- Create: `src/app/api/webhooks/stripe/route.ts`

- [ ] **Step 1: Create the webhook route**

```typescript
// src/app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';
import Stripe from 'stripe';

// Disable body parsing — we need the raw body for signature verification
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const invoiceId = session.metadata?.invoiceId;

    if (!invoiceId) {
      console.error('checkout.session.completed missing invoiceId in metadata');
      return NextResponse.json({ received: true });
    }

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) {
      console.error(`Invoice ${invoiceId} not found for checkout.session.completed`);
      return NextResponse.json({ received: true });
    }

    // Idempotency — skip if already paid
    if (invoice.status === 'paid') {
      return NextResponse.json({ received: true });
    }

    // Determine payment method type
    let paidMethod = 'stripe_card';
    if (session.payment_method_types?.includes('us_bank_account')) {
      // Check the actual payment method used
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(
          session.payment_intent as string,
          { expand: ['payment_method'] },
        );
        const pm = paymentIntent.payment_method as Stripe.PaymentMethod;
        if (pm?.type === 'us_bank_account') {
          paidMethod = 'stripe_ach';
        }
      } catch {
        // Default to stripe_card if we can't determine
      }
    }

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'paid',
        paidAt: new Date(),
        paidMethod,
        stripePaymentIntentId: (session.payment_intent as string) ?? null,
      },
    });
  }

  if (event.type === 'charge.failed') {
    const charge = event.data.object as Stripe.Charge;
    const paymentIntentId =
      typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : charge.payment_intent?.id;

    if (!paymentIntentId) {
      return NextResponse.json({ received: true });
    }

    // Find invoice by payment intent ID
    const invoice = await prisma.invoice.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
    });

    if (invoice && invoice.status === 'paid') {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: 'sent',
          paidAt: null,
          paidMethod: null,
        },
      });
    }
  }

  return NextResponse.json({ received: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/webhooks/stripe/route.ts
git commit -m "feat: Stripe webhook handler for checkout.session.completed and charge.failed"
```

---

### Task 4: Add "Pay Now" Button to PasscodeGate

**Files:**
- Modify: `src/app/invoices/[token]/PasscodeGate.tsx`
- Modify: `src/app/invoices/[token]/page.tsx`

- [ ] **Step 1: Pass invoice status to PasscodeGate**

In `src/app/invoices/[token]/page.tsx`, update the PasscodeGate props to include `invoiceStatus`:

Replace:

```tsx
        <PasscodeGate
          invoiceId={invoice.id}
          token={token}
          alreadyViewed={!!invoice.viewedAt}
        />
```

With:

```tsx
        <PasscodeGate
          invoiceId={invoice.id}
          token={token}
          alreadyViewed={!!invoice.viewedAt}
          invoiceStatus={invoice.status}
        />
```

- [ ] **Step 2: Add "Pay Now" button to the verified state in PasscodeGate**

In `src/app/invoices/[token]/PasscodeGate.tsx`, update the component:

Add `invoiceStatus` to the props type:

```typescript
export default function PasscodeGate({
  invoiceId,
  token,
  alreadyViewed,
  invoiceStatus,
}: {
  invoiceId: string;
  token: string;
  alreadyViewed: boolean;
  invoiceStatus: string;
}) {
```

Add state for the payment flow at the top of the component, alongside the existing state:

```typescript
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
```

Add a `payNow` handler after the existing `verify` function:

```typescript
  const payNow = async () => {
    setPaying(true);
    setPayError('');

    try {
      const res = await fetch(`/api/invoices/${invoiceId}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, passcode }),
      });

      if (!res.ok) {
        const data = await res.json();
        setPayError(data.error ?? 'Failed to start payment');
        setPaying(false);
        return;
      }

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setPayError('Something went wrong. Please try again.');
      setPaying(false);
    }
  };
```

Replace the entire `if (verified)` block (lines 62-71) with:

```tsx
  if (verified) {
    const canPay = invoiceStatus === 'sent' || invoiceStatus === 'viewed';

    return (
      <>
        <div className="bg-white border border-gray-200 rounded" style={{ height: '80vh' }}>
          <iframe
            src={`/api/invoices/${invoiceId}/html?token=${token}&passcode=${passcode}`}
            className="w-full h-full rounded"
            title="Invoice"
          />
        </div>

        {canPay && (
          <div className="mt-6 text-center">
            {payError && (
              <p className="text-red-600 text-sm mb-3">{payError}</p>
            )}
            <button
              onClick={payNow}
              disabled={paying}
              className="bg-gray-900 text-white font-semibold px-8 py-3 rounded text-sm hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {paying ? 'Preparing Payment...' : 'Pay Now Online'}
            </button>
            <p className="text-gray-400 text-xs mt-2">
              Credit card and ACH bank transfer accepted
            </p>
          </div>
        )}

        {invoiceStatus === 'paid' && (
          <div className="mt-6 bg-green-50 border border-green-200 rounded p-4 text-center">
            <p className="text-green-700 font-semibold">Payment Received</p>
            <p className="text-gray-600 text-sm mt-1">Thank you for your payment.</p>
          </div>
        )}
      </>
    );
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/app/invoices/[token]/PasscodeGate.tsx src/app/invoices/[token]/page.tsx
git commit -m "feat: add Pay Now button to public invoice page"
```

---

### Task 5: Post-Payment Success Page

**Files:**
- Create: `src/app/invoices/[token]/success/page.tsx`

- [ ] **Step 1: Create the success page**

```tsx
// src/app/invoices/[token]/success/page.tsx
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export default async function PaymentSuccessPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    notFound();
  }

  const invoice = await prisma.invoice.findFirst({
    where: { viewToken: token },
    include: { project: true },
  });

  if (!invoice) notFound();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md mx-auto px-4 text-center">
        <div className="bg-white border border-gray-200 rounded-lg p-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-xl font-bold text-gray-900 mb-2">Payment Received</h1>
          <p className="text-gray-600 text-sm mb-4">
            Thank you for your payment for <strong>{invoice.project.name}</strong>.
          </p>

          <div className="bg-gray-50 rounded p-3 mb-6 text-sm">
            <p className="text-gray-500">Invoice</p>
            <p className="text-gray-900 font-medium">{invoice.invoiceNumber}</p>
            <p className="text-gray-500 mt-2">Amount</p>
            <p className="text-gray-900 font-medium">
              ${invoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>

          <p className="text-gray-500 text-xs mb-6">
            Your payment is being processed. You&apos;ll receive a confirmation once it&apos;s complete.
          </p>

          <Link
            href={`/invoices/${token}`}
            className="text-gray-600 text-sm hover:text-gray-900 underline"
          >
            Back to invoice
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/invoices/[token]/success/page.tsx
git commit -m "feat: post-payment success page"
```

---

## Post-Implementation Notes

**Environment variables to configure:**
- `STRIPE_SECRET_KEY` — from Stripe Dashboard → Developers → API keys
- `STRIPE_WEBHOOK_SECRET` — from Stripe Dashboard → Developers → Webhooks (or `stripe listen` output for local dev)

**Stripe Dashboard webhook setup:**
- Endpoint URL: `https://buildingnv.us/api/webhooks/stripe`
- Events to send: `checkout.session.completed`, `charge.failed`

**Local development testing:**
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local dev server
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Copy the webhook signing secret from the output and set as STRIPE_WEBHOOK_SECRET
```

**Testing the flow:**
1. Create an invoice in the system
2. Send it (generates token + passcode)
3. Open the public invoice URL
4. Enter passcode
5. Click "Pay Now"
6. Complete payment on Stripe's checkout page (use test cards: `4242424242424242` for card, or test bank for ACH)
7. Verify redirect to success page
8. Verify invoice status auto-updates to `paid` via webhook
