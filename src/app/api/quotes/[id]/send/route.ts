import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendSigningLink } from '@/lib/docs/email';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { client: true },
  });

  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (quote.status === 'quote_signed') return NextResponse.json({ error: 'Already signed' }, { status: 409 });
  if (!quote.client.email) return NextResponse.json({ error: 'Client has no email address' }, { status: 422 });

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await prisma.quote.update({
    where: { id },
    data: {
      signingToken: token,
      signingTokenExpiresAt: expiresAt,
      status: 'sent',
      sentAt: new Date(),
    },
  });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const signingUrl = `${baseUrl}/proposals/${token}`;

  let emailSent = true;
  try {
    await sendSigningLink({
      toEmail: quote.client.email,
      toName: quote.client.name,
      projectTitle: quote.title,
      signingUrl,
      docLabel: 'Proposal',
    });
  } catch (err) {
    console.error('Failed to send signing link email:', err);
    emailSent = false;
  }

  return NextResponse.json({ token, signingUrl, emailSent });
}
