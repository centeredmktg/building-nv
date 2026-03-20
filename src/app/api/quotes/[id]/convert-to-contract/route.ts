import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { renderQuoteHtml } from '@/lib/docs/quote-template';
import { renderMsaHtml } from '@/lib/docs/msa-template';
import { calculateQuoteTotals } from '@/lib/pricing';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const DOCS_DIR = () => process.env.DOCS_DIR ?? path.join(process.cwd(), 'docs-storage');

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      client: true,
      sections: { include: { items: { orderBy: { position: 'asc' } } }, orderBy: { position: 'asc' } },
    },
  });

  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (quote.status !== 'quote_signed') {
    return NextResponse.json({ error: 'Quote must be signed before converting to contract' }, { status: 422 });
  }

  // Return existing contract if already created
  const existing = await prisma.contract.findUnique({ where: { quoteId: id } });
  if (existing) return NextResponse.json(existing);

  const effectiveDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const docsDir = DOCS_DIR();
  mkdirSync(docsDir, { recursive: true });

  const msaHtml = renderMsaHtml({
    clientName: quote.client.name,
    projectTitle: quote.title,
    projectAddress: quote.address,
    contractorLicense: process.env.BNV_LICENSE ?? 'NV B2 #[LICENSE]',
    effectiveDate,
    exhibitATitle: quote.title,
    paymentTerms: quote.paymentTerms,
  });

  const quoteHtml = renderQuoteHtml(quote);
  // Extract just the body content from quoteHtml to embed as Exhibit A
  const quoteBodyContent = quoteHtml
    .replace(/<!DOCTYPE html>[\s\S]*?<body[^>]*>/i, '')
    .replace(/<\/body>[\s\S]*?<\/html>/i, '');

  const exhibitA = `
<div style="page-break-before:always;">
  <p style="text-align:center;font-size:11px;font-family:sans-serif;text-transform:uppercase;letter-spacing:.1em;color:#888;padding:16px 0;">Exhibit A — Signed Proposal</p>
  ${quoteBodyContent}
</div>`;

  const contractHtml = msaHtml.replace('</body>', `${exhibitA}\n</body>`);

  const allItems = quote.sections.flatMap((s) =>
    s.items.map((i) => ({ unitPrice: i.unitPrice, quantity: i.quantity, isMaterial: i.isMaterial }))
  );
  const totals = calculateQuoteTotals(allItems, quote.materialMarkupPct, quote.overheadPct, quote.profitPct);

  const contractId = randomUUID();
  const htmlPath = path.join(docsDir, `${contractId}-contract.html`);
  writeFileSync(htmlPath, contractHtml, 'utf-8');

  const contract = await prisma.contract.create({
    data: {
      id: contractId,
      quoteId: quote.id,
      projectId: quote.projectId ?? null,
      htmlPath,
      contractAmount: totals.total,
      status: 'draft',
    },
  });

  return NextResponse.json(contract);
}
