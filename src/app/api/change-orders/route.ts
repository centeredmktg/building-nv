import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { renderChangeOrderHtml } from '@/lib/docs/change-order-template';
import { writeFileSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import path from 'path';

const DOCS_DIR = () => process.env.DOCS_DIR ?? path.join(process.cwd(), 'docs-storage');

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { contractId?: string; title?: string; scopeDelta?: string; priceDelta?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (!body.contractId || !body.title || !body.scopeDelta || typeof body.priceDelta !== 'number' || !isFinite(body.priceDelta)) {
    return NextResponse.json({ error: 'Missing required fields: contractId, title, scopeDelta, priceDelta' }, { status: 400 });
  }

  const contract = await prisma.contract.findUnique({
    where: { id: body.contractId },
    include: { quote: { include: { client: true } } },
  });

  if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  if (contract.status !== 'executed') {
    return NextResponse.json({ error: 'Contract must be executed before issuing a change order' }, { status: 422 });
  }

  const coCount = await prisma.changeOrder.count({ where: { contractId: body.contractId } });
  const coNumber = coCount + 1;

  const effectiveDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const contractDate = contract.createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const coHtml = renderChangeOrderHtml({
    coNumber,
    projectTitle: contract.quote.title,
    clientName: contract.quote.client?.name ?? 'Client',
    contractDate,
    scopeDelta: body.scopeDelta,
    priceDelta: body.priceDelta,
    originalContractAmount: contract.contractAmount ?? 0,
    effectiveDate,
  });

  const docsDir = DOCS_DIR();
  mkdirSync(docsDir, { recursive: true });

  const coId = randomUUID();
  const htmlPath = path.join(docsDir, `${coId}-co.html`);
  writeFileSync(htmlPath, coHtml, 'utf-8');

  const changeOrder = await prisma.changeOrder.create({
    data: {
      id: coId,
      contractId: body.contractId,
      number: coNumber,
      title: body.title,
      scopeDelta: body.scopeDelta,
      priceDelta: body.priceDelta,
      htmlPath,
      status: 'draft',
    },
  });

  return NextResponse.json(changeOrder, { status: 201 });
}
