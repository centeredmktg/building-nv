// src/app/api/invoices/[id]/pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readFileSync, existsSync } from 'fs';
import { generatePDF } from '@/lib/docs/pdf';
import path from 'path';

const DOCS_DIR = () => process.env.DOCS_DIR ?? path.join(process.cwd(), 'docs-storage');

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { project: true },
  });

  if (!invoice) return new NextResponse('Not found', { status: 404 });
  if (!invoice.htmlPath || !existsSync(invoice.htmlPath)) {
    return new NextResponse('HTML artifact not found', { status: 404 });
  }

  const pdfPath = path.join(DOCS_DIR(), `${id}-invoice.pdf`);

  // Generate PDF on demand from the HTML artifact
  const html = readFileSync(invoice.htmlPath, 'utf-8');
  await generatePDF(html, pdfPath);

  const pdfBuffer = readFileSync(pdfPath);
  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${invoice.invoiceNumber}.pdf"`,
    },
  });
}
