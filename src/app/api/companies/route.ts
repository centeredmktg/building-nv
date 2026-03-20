import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = req.nextUrl.searchParams.get('q') ?? '';
  if (!q.trim()) return NextResponse.json([]);

  const companies = await prisma.company.findMany({
    where: { name: { contains: q } },
    orderBy: { name: 'asc' },
    take: 10,
  });
  return NextResponse.json(companies);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { name?: string; domain?: string };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  try {
    const company = await prisma.company.create({
      data: {
        name: body.name.trim(),
        domain: body.domain?.trim().toLowerCase() || null,
        type: 'customer',
      },
    });
    return NextResponse.json(company, { status: 201 });
  } catch (e) {
    if (e instanceof Error && 'code' in e && e.code === 'P2002') {
      return NextResponse.json({ error: 'A company with this domain already exists' }, { status: 409 });
    }
    throw e;
  }
}
