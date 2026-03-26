// src/app/api/invoices/[id]/send/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { randomUUID } from 'crypto';
import { generatePasscode } from '@/lib/invoice-numbering';
import { sendInvoiceLink } from '@/lib/docs/email';

const BASE_URL = () => process.env.NEXT_PUBLIC_BASE_URL ?? 'https://buildingnv.us';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      billingContact: true,
      project: true,
    },
  });

  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

  if (invoice.status !== 'draft' && invoice.status !== 'sent') {
    return NextResponse.json(
      { error: `Cannot send invoice in status: ${invoice.status}` },
      { status: 422 },
    );
  }

  if (!invoice.billingContact.email) {
    return NextResponse.json(
      { error: 'Billing contact has no email address' },
      { status: 422 },
    );
  }

  // Generate or reuse token + passcode
  const viewToken = invoice.viewToken ?? randomUUID();
  const passcode = invoice.passcode ?? generatePasscode();

  const viewUrl = `${BASE_URL()}/invoices/${viewToken}`;
  const dueDateStr = invoice.dueDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const contactName = [invoice.billingContact.firstName, invoice.billingContact.lastName]
    .filter(Boolean)
    .join(' ');

  // Send the email
  await sendInvoiceLink({
    toEmail: invoice.billingContact.email,
    toName: contactName,
    projectTitle: invoice.project.name,
    invoiceNumber: invoice.invoiceNumber,
    amount: invoice.amount,
    dueDate: dueDateStr,
    viewUrl,
  });

  // Update invoice record
  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      viewToken,
      passcode,
      status: 'sent',
      sentAt: new Date(),
    },
  });

  // Return passcode so the sender can share it out-of-band
  return NextResponse.json({
    ...updated,
    passcode,
    message: `Invoice sent to ${invoice.billingContact.email}. Share passcode separately: ${passcode}`,
  });
}
