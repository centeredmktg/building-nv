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
