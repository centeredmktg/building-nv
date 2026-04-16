// src/app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';
import { sendPaymentReceipt } from '@/lib/docs/email';
import Stripe from 'stripe';

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

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { billingContact: true, project: true },
    });
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

    const paidAt = new Date();
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'paid',
        paidAt,
        paidMethod,
        stripePaymentIntentId: (session.payment_intent as string) ?? null,
      },
    });

    // Send payment receipt email
    const contactEmail = invoice.billingContact.email;
    if (contactEmail) {
      const contactName = [invoice.billingContact.firstName, invoice.billingContact.lastName]
        .filter(Boolean)
        .join(' ');
      const methodLabel = paidMethod === 'stripe_ach' ? 'ACH Bank Transfer' : 'Credit Card';
      try {
        await sendPaymentReceipt({
          toEmail: contactEmail,
          toName: contactName,
          projectTitle: invoice.project.name,
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.amount,
          paidDate: paidAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          paymentMethod: methodLabel,
        });
      } catch (err) {
        // Receipt is nice-to-have — don't fail the webhook if email fails
        console.error('Failed to send payment receipt:', err);
      }
    }
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
