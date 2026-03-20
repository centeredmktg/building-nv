import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateSignedPDF } from '@/lib/docs/pdf';
import { sendSignedPDF } from '@/lib/docs/email';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const DOCS_DIR = () => process.env.DOCS_DIR ?? path.join(process.cwd(), 'docs-storage');

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  const changeOrder = await prisma.changeOrder.findFirst({
    where: { signingToken: token },
    include: { contract: { include: { quote: { include: { client: true } } } } },
  });

  if (!changeOrder) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (changeOrder.status === 'executed') return NextResponse.json({ error: 'Already signed' }, { status: 409 });

  if (changeOrder.signingTokenExpiresAt && new Date() > changeOrder.signingTokenExpiresAt) {
    return NextResponse.json({ error: 'Link expired' }, { status: 410 });
  }

  if (!changeOrder.htmlPath) return NextResponse.json({ error: 'Change order HTML not found' }, { status: 422 });

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

  const docsDir = DOCS_DIR();
  mkdirSync(docsDir, { recursive: true });

  const sigBase64 = body.signature.replace(/^data:image\/png;base64,/, '');
  const sigPath = path.join(docsDir, `${token}-co-sig.png`);
  writeFileSync(sigPath, Buffer.from(sigBase64, 'base64'));

  const coHtml = readFileSync(changeOrder.htmlPath, 'utf-8');
  const pdfPath = path.join(docsDir, `${token}-co-signed.pdf`);

  try {
    await generateSignedPDF(coHtml, pdfPath, body.signature);
  } catch (err) {
    console.error('Change order PDF generation failed:', err);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }

  const signedAt = new Date();

  await prisma.changeOrder.update({
    where: { id: changeOrder.id },
    data: {
      status: 'executed',
      signerName: body.signerName,
      signedAt,
      signedPdfPath: pdfPath,
    },
  });

  // Update contract amount by adding priceDelta
  try {
    await prisma.contract.update({
      where: { id: changeOrder.contractId },
      data: { contractAmount: (changeOrder.contract.contractAmount ?? 0) + changeOrder.priceDelta },
    });
  } catch (err) {
    console.error('Failed to update contract amount after CO execution:', err);
  }

  // Send signed PDF (non-blocking)
  if (changeOrder.contract.quote.client.email) {
    try {
      await sendSignedPDF({
        toEmail: changeOrder.contract.quote.client.email,
        toName: changeOrder.contract.quote.client.name,
        projectTitle: changeOrder.contract.quote.title,
        signedPdfPath: pdfPath,
        docLabel: 'Change Order',
      });
    } catch (err) {
      console.error('Email failed after change order signing:', err);
    }
  }

  return NextResponse.json({ ok: true, signedAt: signedAt.toISOString() });
}
