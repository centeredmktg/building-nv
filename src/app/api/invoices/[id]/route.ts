// src/app/api/invoices/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      billingContact: true,
      billingCompany: true,
      project: true,
      contract: true,
      changeOrder: true,
      invoiceMilestones: { include: { milestone: true } },
    },
  });

  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  return NextResponse.json(invoice);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  let body: {
    status?: string;
    paidMethod?: string;
    notes?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

  const data: Record<string, unknown> = {};

  if (body.status === 'paid') {
    if (!body.paidMethod) {
      return NextResponse.json({ error: 'paidMethod required when marking as paid' }, { status: 400 });
    }
    data.status = 'paid';
    data.paidAt = new Date();
    data.paidMethod = body.paidMethod;
  } else if (body.status) {
    const validTransitions: Record<string, string[]> = {
      draft: ['sent'],
      sent: ['viewed', 'paid'],
      viewed: ['paid'],
    };
    if (!validTransitions[invoice.status]?.includes(body.status)) {
      return NextResponse.json(
        { error: `Cannot transition from ${invoice.status} to ${body.status}` },
        { status: 422 },
      );
    }
    data.status = body.status;
  }

  if (body.notes !== undefined) {
    data.notes = body.notes;
  }

  const updated = await prisma.invoice.update({ where: { id }, data });
  return NextResponse.json(updated);
}
