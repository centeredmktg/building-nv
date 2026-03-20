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
  const changeOrder = await prisma.changeOrder.findUnique({
    where: { id },
    include: { contract: { include: { quote: { include: { client: true } } } } },
  });

  if (!changeOrder) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (changeOrder.status === 'executed') return NextResponse.json({ error: 'Change order already executed' }, { status: 409 });
  if (!changeOrder.contract.quote.client.email) {
    return NextResponse.json({ error: 'Client has no email address' }, { status: 422 });
  }

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.changeOrder.update({
    where: { id },
    data: {
      signingToken: token,
      signingTokenExpiresAt: expiresAt,
      status: 'co_sent',
      sentAt: new Date(),
    },
  });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const signingUrl = `${baseUrl}/change-orders/${token}`;

  let emailSent = true;
  try {
    await sendSigningLink({
      toEmail: changeOrder.contract.quote.client.email,
      toName: changeOrder.contract.quote.client.name,
      projectTitle: changeOrder.contract.quote.title,
      signingUrl,
      docLabel: 'Change Order',
    });
  } catch (err) {
    console.error('Failed to send change order signing link:', err);
    emailSent = false;
  }

  return NextResponse.json({ token, signingUrl, emailSent });
}
