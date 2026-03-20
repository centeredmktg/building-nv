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

  const contract = await prisma.contract.findFirst({
    where: { signingToken: token },
    include: { quote: { include: { client: true } } },
  });

  if (!contract) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (contract.status === 'executed') return NextResponse.json({ error: 'Already signed' }, { status: 409 });

  if (contract.signingTokenExpiresAt && new Date() > contract.signingTokenExpiresAt) {
    return NextResponse.json({ error: 'Link expired' }, { status: 410 });
  }

  if (!contract.htmlPath) return NextResponse.json({ error: 'Contract HTML not found' }, { status: 422 });

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
  const sigPath = path.join(docsDir, `${token}-contract-sig.png`);
  writeFileSync(sigPath, Buffer.from(sigBase64, 'base64'));

  const contractHtml = readFileSync(contract.htmlPath, 'utf-8');
  const pdfPath = path.join(docsDir, `${token}-contract-signed.pdf`);

  try {
    await generateSignedPDF(contractHtml, pdfPath, body.signature);
  } catch (err) {
    console.error('Contract PDF generation failed:', err);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }

  const signedAt = new Date();
  const signerIp = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || null;

  await prisma.contract.update({
    where: { id: contract.id },
    data: {
      status: 'executed',
      signerName: body.signerName,
      signedAt,
      signedPdfPath: pdfPath,
      signerIp,
    },
  });

  // Auto-update project stage when contract executed
  if (contract.projectId) {
    try {
      await prisma.project.update({
        where: { id: contract.projectId },
        data: { stage: 'contract_signed' },
      });
    } catch (err) {
      console.error('Failed to update project stage:', err);
    }
  }

  // Send signed PDF (non-blocking)
  if (contract.quote.client.email) {
    try {
      await sendSignedPDF({
        toEmail: contract.quote.client.email,
        toName: contract.quote.client.name,
        projectTitle: contract.quote.title,
        signedPdfPath: pdfPath,
        docLabel: 'Contract',
      });
    } catch (err) {
      console.error('Email failed after contract signing:', err);
    }
  }

  return NextResponse.json({ ok: true, signedAt: signedAt.toISOString() });
}
