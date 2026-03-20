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
  const contract = await prisma.contract.findUnique({
    where: { id },
    include: { quote: { include: { client: true } } },
  });

  if (!contract) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (contract.status === 'executed') return NextResponse.json({ error: 'Contract already executed' }, { status: 409 });
  if (!contract.htmlPath) return NextResponse.json({ error: 'Contract document not generated yet' }, { status: 422 });
  if (!contract.quote.client.email) return NextResponse.json({ error: 'Client has no email address' }, { status: 422 });

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.contract.update({
    where: { id },
    data: {
      signingToken: token,
      signingTokenExpiresAt: expiresAt,
      status: 'contract_sent',
      sentAt: new Date(),
    },
  });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const signingUrl = `${baseUrl}/contracts/${token}`;

  let emailSent = true;
  try {
    await sendSigningLink({
      toEmail: contract.quote.client.email,
      toName: contract.quote.client.name,
      projectTitle: contract.quote.title,
      signingUrl,
      docLabel: 'Contract',
    });
  } catch (err) {
    console.error('Failed to send contract signing link:', err);
    emailSent = false;
  }

  return NextResponse.json({ token, signingUrl, emailSent });
}
