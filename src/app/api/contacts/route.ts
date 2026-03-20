import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = req.nextUrl.searchParams.get('q') ?? '';
  if (!q.trim()) return NextResponse.json([]);

  const contacts = await prisma.contact.findMany({
    where: {
      OR: [
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { email: { contains: q } },
      ],
    },
    include: { primaryCompany: true },
    orderBy: { firstName: 'asc' },
    take: 10,
  });
  return NextResponse.json(contacts);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };

  if (!body.firstName?.trim()) {
    return NextResponse.json({ error: 'firstName is required' }, { status: 400 });
  }

  try {
    const contact = await prisma.contact.create({
      data: {
        firstName: body.firstName.trim(),
        lastName: body.lastName?.trim() || null,
        email: body.email?.trim().toLowerCase() || null,
        phone: body.phone?.trim() || null,
        type: 'customer',
      },
    });
    return NextResponse.json(contact, { status: 201 });
  } catch (e) {
    if (e instanceof Error && 'code' in e && e.code === 'P2002') {
      return NextResponse.json({ error: 'A contact with this email already exists' }, { status: 409 });
    }
    throw e;
  }
}
