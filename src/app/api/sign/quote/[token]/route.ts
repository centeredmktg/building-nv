import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateSignedPDF } from '@/lib/docs/pdf';
import { sendSignedPDF } from '@/lib/docs/email';
import { renderQuoteHtml } from '@/lib/docs/quote-template';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const DOCS_DIR = () => process.env.DOCS_DIR ?? path.join(process.cwd(), 'docs-storage');

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Validate token is a UUID format to prevent path traversal
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  const quote = await prisma.quote.findFirst({
    where: { signingToken: token },
    include: {
      client: true,
      sections: { include: { items: { orderBy: { position: 'asc' } } }, orderBy: { position: 'asc' } },
      acceptance: true,
    },
  });

  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (quote.status === 'quote_signed') return NextResponse.json({ error: 'Already signed' }, { status: 409 });

  if (quote.signingTokenExpiresAt && new Date() > quote.signingTokenExpiresAt) {
    return NextResponse.json({ error: 'Link expired' }, { status: 410 });
  }

  let body: { signature?: string; signerName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (!body.signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  if (!body.signerName) return NextResponse.json({ error: 'Missing signerName' }, { status: 400 });
  if (!body.signature.startsWith('data:image/png;base64,')) {
    return NextResponse.json({ error: 'Invalid signature format' }, { status: 400 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'unknown';
  const docsDir = DOCS_DIR();
  mkdirSync(docsDir, { recursive: true });

  // Save signature PNG
  const sigBase64 = body.signature.replace(/^data:image\/png;base64,/, '');
  const sigPath = path.join(docsDir, `${token}-sig.png`);
  writeFileSync(sigPath, Buffer.from(sigBase64, 'base64'));

  // Generate signed PDF
  const quoteHtml = renderQuoteHtml(quote);
  const pdfPath = path.join(docsDir, `${token}-signed.pdf`);
  try {
    await generateSignedPDF(quoteHtml, pdfPath, body.signature);
  } catch (err) {
    console.error('PDF generation failed:', err);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }

  const signedAt = new Date();

  // Upsert Acceptance with signature
  if (quote.acceptance) {
    await prisma.acceptance.update({
      where: { quoteId: quote.id },
      data: { signerName: body.signerName, signaturePngPath: sigPath, acceptedAt: signedAt, ipAddress: ip },
    });
  } else {
    await prisma.acceptance.create({
      data: { quoteId: quote.id, signerName: body.signerName, signaturePngPath: sigPath, acceptedAt: signedAt, ipAddress: ip },
    });
  }

  await prisma.quote.update({
    where: { id: quote.id },
    data: { status: 'quote_signed', signedAt, signedPdfPath: pdfPath },
  });

  // Send PDF — don't fail request if email fails
  if (quote.client.email) {
    try {
      await sendSignedPDF({
        toEmail: quote.client.email,
        toName: quote.client.name,
        projectTitle: quote.title,
        signedPdfPath: pdfPath,
        docLabel: 'Proposal',
      });
    } catch (err) {
      console.error('Email failed after signing:', err);
    }
  }

  return NextResponse.json({ ok: true, signedAt: signedAt.toISOString() });
}
