import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { renderInvoiceHtml } from '@/lib/docs/invoice-template';
import { buildInvoiceNumber } from '@/lib/invoice-numbering';
import { syncInvoiceIfConnected } from '@/lib/quickbooks/sync';
import { writeFileSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import path from 'path';

const DOCS_DIR = () => process.env.DOCS_DIR ?? path.join(process.cwd(), 'docs-storage');

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const invoices = await prisma.invoice.findMany({
    where: { projectId: id },
    include: {
      billingContact: true,
      billingCompany: true,
      invoiceMilestones: { include: { milestone: true } },
    },
    orderBy: { sequenceNumber: 'desc' },
  });

  return NextResponse.json(invoices);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: projectId } = await params;

  let body: {
    contractId?: string;
    milestoneIds?: string[];
    changeOrderId?: string;
    billingContactId?: string;
    billingCompanyId?: string;
    issueDate?: string;
    dueDate?: string;
    notes?: string;
    amount?: number;
    amountAdjustmentNote?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.contractId || !body.billingContactId || !body.milestoneIds?.length) {
    return NextResponse.json(
      { error: 'Missing required fields: contractId, billingContactId, milestoneIds (at least one)' },
      { status: 400 },
    );
  }

  // Verify project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      contracts: {
        where: { id: body.contractId },
        include: {
          changeOrders: { where: { status: 'executed' } },
        },
      },
    },
  });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const contract = project.contracts[0];
  if (!contract) return NextResponse.json({ error: 'Contract not found on this project' }, { status: 404 });

  // Verify milestones exist and are not already billed
  const milestones = await prisma.milestone.findMany({
    where: { id: { in: body.milestoneIds }, projectId },
    include: { invoiceMilestones: true },
  });

  if (milestones.length !== body.milestoneIds.length) {
    return NextResponse.json({ error: 'One or more milestones not found' }, { status: 404 });
  }

  const alreadyBilled = milestones.filter((m) => m.invoiceMilestones.length > 0);
  if (alreadyBilled.length > 0) {
    return NextResponse.json(
      { error: `Milestones already billed: ${alreadyBilled.map((m) => m.name).join(', ')}` },
      { status: 422 },
    );
  }

  // Calculate amount from milestone billing amounts
  const milestoneSum = milestones.reduce((sum, m) => sum + (m.billingAmount ?? 0), 0);
  const invoiceAmount = body.amount ?? milestoneSum;

  // If amount differs from milestone sum, require adjustment note
  if (body.amount != null && Math.abs(body.amount - milestoneSum) > 0.01 && !body.amountAdjustmentNote) {
    return NextResponse.json(
      { error: 'amountAdjustmentNote required when amount differs from milestone sum' },
      { status: 400 },
    );
  }

  // Sequence number
  const lastInvoice = await prisma.invoice.findFirst({
    where: { projectId },
    orderBy: { sequenceNumber: 'desc' },
  });
  const sequenceNumber = (lastInvoice?.sequenceNumber ?? 0) + 1;

  // Issue and due dates
  const issueDate = body.issueDate ? new Date(body.issueDate) : new Date();
  const dueDate = body.dueDate
    ? new Date(body.dueDate)
    : new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000); // net-30

  const invoiceNumber = buildInvoiceNumber(project.shortCode, issueDate, sequenceNumber, project.id);

  // Resolve billing contact and company
  const billingContact = await prisma.contact.findUnique({ where: { id: body.billingContactId } });
  if (!billingContact) return NextResponse.json({ error: 'Billing contact not found' }, { status: 404 });

  let billingCompany = null;
  if (body.billingCompanyId) {
    billingCompany = await prisma.company.findUnique({ where: { id: body.billingCompanyId } });
  }

  // Calculate financial summary for template
  const coTotal = contract.changeOrders.reduce((sum, co) => sum + co.priceDelta, 0);
  const originalContractAmount = contract.contractAmount ?? 0;
  const adjustedContractTotal = originalContractAmount + coTotal;

  const priorInvoices = await prisma.invoice.findMany({
    where: {
      projectId,
      status: { in: ['sent', 'viewed', 'paid'] },
    },
    select: { amount: true },
  });
  const previouslyInvoiced = priorInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  // Build site address string
  const siteAddress = project.siteAddress
    ? `${project.siteAddress}${project.siteCity ? `, ${project.siteCity}` : ''}${project.siteState ? `, ${project.siteState}` : ''} ${project.siteZip ?? ''}`.trim()
    : null;

  // Get all milestones for the schedule
  const allProjectMilestones = await prisma.milestone.findMany({
    where: { projectId },
    include: { invoiceMilestones: true },
    orderBy: { position: 'asc' },
  });

  const billedMilestoneIds = new Set(body.milestoneIds);

  // Render HTML
  const html = renderInvoiceHtml({
    invoiceNumber,
    issueDate,
    dueDate,
    contractorName: 'CPP Painting & Construction LLC',
    contractorAddress: '5401 Longley Lane, Ste C81, Reno, NV 89511',
    contractorPhone: process.env.CONTRACTOR_PHONE ?? '',
    contractorEmail: process.env.PAYMENT_CONTACT_EMAIL ?? 'danny@buildingnv.us',
    contractorLicense: '0092515',
    billingContactName: [billingContact.firstName, billingContact.lastName].filter(Boolean).join(' '),
    billingCompanyName: billingCompany?.name ?? null,
    projectName: project.name,
    projectType: project.projectType,
    siteAddress,
    billedMilestones: milestones.map((m) => ({
      name: m.name,
      description: m.notes,
      amount: m.billingAmount ?? 0,
    })),
    changeOrderRef: body.changeOrderId
      ? (() => {
          const co = contract.changeOrders.find((c) => c.id === body.changeOrderId);
          return co ? { number: co.number, title: co.title } : null;
        })()
      : null,
    invoiceTotal: invoiceAmount,
    notes: body.notes ?? null,
    originalContractAmount,
    changeOrderTotal: coTotal,
    changeOrderCount: contract.changeOrders.length,
    adjustedContractTotal,
    previouslyInvoiced,
    thisInvoiceAmount: invoiceAmount,
    remainingBalance: adjustedContractTotal - previouslyInvoiced - invoiceAmount,
    allMilestones: allProjectMilestones.map((m) => ({
      name: m.name,
      billingAmount: m.billingAmount,
      plannedDate: m.plannedDate,
      completedAt: m.completedAt,
      isCurrent: billedMilestoneIds.has(m.id),
    })),
    bankName: process.env.BANK_NAME ?? 'Western Alliance Bank',
    routingNumber: process.env.BANK_ROUTING ?? '',
    accountNumber: process.env.BANK_ACCOUNT ?? '',
    paymentContactName: process.env.PAYMENT_CONTACT_NAME ?? 'Danny Cox',
    paymentContactPhone: process.env.PAYMENT_CONTACT_PHONE ?? '',
    paymentContactEmail: process.env.PAYMENT_CONTACT_EMAIL ?? 'danny@buildingnv.us',
  });

  // Save HTML artifact
  const docsDir = DOCS_DIR();
  mkdirSync(docsDir, { recursive: true });
  const invoiceId = randomUUID();
  const htmlPath = path.join(docsDir, `${invoiceId}-invoice.html`);
  writeFileSync(htmlPath, html, 'utf-8');

  // Create invoice and junction records in a transaction
  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        id: invoiceId,
        invoiceNumber,
        sequenceNumber,
        projectId,
        contractId: body.contractId!,
        changeOrderId: body.changeOrderId ?? null,
        billingContactId: body.billingContactId!,
        billingCompanyId: body.billingCompanyId ?? null,
        amount: invoiceAmount,
        amountAdjustmentNote: body.amountAdjustmentNote ?? null,
        issueDate,
        dueDate,
        notes: body.notes ?? null,
        status: 'draft',
        htmlPath,
      },
    });

    // Create junction records
    for (const milestoneId of body.milestoneIds!) {
      await tx.invoiceMilestone.create({
        data: { invoiceId: inv.id, milestoneId },
      });
    }

    return inv;
  });

  syncInvoiceIfConnected(invoice.id);
  return NextResponse.json(invoice, { status: 201 });
}
