import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readFileSync, existsSync } from 'fs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.nextUrl.searchParams.get('token');

  const changeOrder = await prisma.changeOrder.findUnique({ where: { id } });
  if (!changeOrder) return new NextResponse('Not found', { status: 404 });

  // Require token to match — prevents unauthenticated access to arbitrary change orders
  if (!token || token !== changeOrder.signingToken) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  if (!changeOrder.htmlPath || !existsSync(changeOrder.htmlPath)) {
    return new NextResponse('Document not found', { status: 404 });
  }

  const html = readFileSync(changeOrder.htmlPath, 'utf-8');
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
