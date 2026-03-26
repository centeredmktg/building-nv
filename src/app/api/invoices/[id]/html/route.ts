// src/app/api/invoices/[id]/html/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readFileSync, existsSync } from 'fs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.nextUrl.searchParams.get('token');
  const passcode = req.nextUrl.searchParams.get('passcode');

  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) return new NextResponse('Not found', { status: 404 });

  // Allow authenticated internal users to preview without token/passcode
  const session = await getServerSession(authOptions);
  if (session) {
    if (!invoice.htmlPath || !existsSync(invoice.htmlPath)) {
      return new NextResponse('Document not found', { status: 404 });
    }
    const html = readFileSync(invoice.htmlPath, 'utf-8');
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Public access requires token + passcode
  if (!token || !passcode) {
    return new NextResponse('Missing token or passcode', { status: 400 });
  }

  // Validate token
  if (token !== invoice.viewToken) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Check rate limit on passcode attempts
  if (invoice.passcodeLockedUntil && new Date() < invoice.passcodeLockedUntil) {
    return new NextResponse('Too many attempts. Try again later.', { status: 429 });
  }

  // Validate passcode
  if (passcode !== invoice.passcode) {
    const newFailures = invoice.passcodeFailures + 1;
    const lockout = newFailures >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
    await prisma.invoice.update({
      where: { id },
      data: {
        passcodeFailures: newFailures,
        passcodeLockedUntil: lockout,
      },
    });
    return new NextResponse('Invalid passcode', { status: 403 });
  }

  // Reset failure count on success
  if (invoice.passcodeFailures > 0) {
    await prisma.invoice.update({
      where: { id },
      data: { passcodeFailures: 0, passcodeLockedUntil: null },
    });
  }

  // Stamp first view
  if (!invoice.viewedAt) {
    await prisma.invoice.update({
      where: { id },
      data: {
        viewedAt: new Date(),
        status: invoice.status === 'sent' ? 'viewed' : invoice.status,
      },
    });
  }

  if (!invoice.htmlPath || !existsSync(invoice.htmlPath)) {
    return new NextResponse('Document not found', { status: 404 });
  }

  const html = readFileSync(invoice.htmlPath, 'utf-8');
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
