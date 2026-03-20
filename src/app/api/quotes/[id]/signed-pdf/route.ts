import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readFileSync } from 'fs';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const quote = await prisma.quote.findUnique({ where: { id }, select: { signedPdfPath: true } });
  if (!quote?.signedPdfPath) return new NextResponse('Not found', { status: 404 });

  const pdf = readFileSync(quote.signedPdfPath);
  return new NextResponse(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="signed-quote.pdf"',
    },
  });
}
