import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readFileSync, existsSync } from 'fs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.nextUrl.searchParams.get('token');

  const contract = await prisma.contract.findUnique({ where: { id } });
  if (!contract) return new NextResponse('Not found', { status: 404 });

  // Require token to match — prevents unauthenticated access to arbitrary contracts
  if (!token || token !== contract.signingToken) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  if (!contract.htmlPath || !existsSync(contract.htmlPath)) {
    return new NextResponse('Document not found', { status: 404 });
  }

  const html = readFileSync(contract.htmlPath, 'utf-8');
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
