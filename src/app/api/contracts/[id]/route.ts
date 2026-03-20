import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const contract = await prisma.contract.findUnique({
    where: { id },
    include: { quote: { include: { client: true } }, changeOrders: { orderBy: { number: 'asc' } } },
  });

  if (!contract) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(contract);
}
