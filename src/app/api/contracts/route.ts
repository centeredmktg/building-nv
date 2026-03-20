import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get('projectId');
  const quoteId = req.nextUrl.searchParams.get('quoteId');

  const where: Record<string, string> = {};
  if (projectId) where.projectId = projectId;
  if (quoteId) where.quoteId = quoteId;

  const contracts = await prisma.contract.findMany({
    where,
    include: { changeOrders: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(contracts);
}
