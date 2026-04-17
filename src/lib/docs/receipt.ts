// src/lib/docs/receipt.ts
import 'server-only';
import { prisma } from '@/lib/prisma';
import { renderReceiptHtml } from '@/lib/docs/receipt-template';
import { generatePDFBuffer } from '@/lib/docs/pdf';
import { sendPaymentReceipt } from '@/lib/docs/email';

const PAID_METHOD_LABELS: Record<string, string> = {
  check: 'Check',
  ach: 'ACH',
  other: 'Other',
  stripe_card: 'Credit Card',
  stripe_ach: 'ACH Bank Transfer',
};

/**
 * Generate receipt HTML, PDF, and send email for a paid invoice.
 * Called by both the Stripe webhook and the manual "Mark Paid" PATCH route.
 * Silently returns if invoice is not paid or has no billing contact email.
 */
export async function generateAndSendReceipt(invoiceId: string): Promise<void> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      billingContact: true,
      billingCompany: true,
      project: true,
      contract: {
        include: {
          changeOrders: { where: { status: 'executed' } },
        },
      },
    },
  });

  if (!invoice || invoice.status !== 'paid' || !invoice.paidAt) return;

  const contactEmail = invoice.billingContact.email;
  if (!contactEmail) return;

  // Calculate total paid to date (all paid invoices for this project)
  const paidInvoices = await prisma.invoice.findMany({
    where: { projectId: invoice.projectId, status: 'paid' },
    select: { amount: true },
  });
  const totalPaidToDate = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  // Financial summary
  const originalContractAmount = invoice.contract.contractAmount ?? 0;
  const changeOrderTotal = invoice.contract.changeOrders.reduce((sum, co) => sum + co.priceDelta, 0);
  const changeOrderCount = invoice.contract.changeOrders.length;
  const adjustedContractTotal = originalContractAmount + changeOrderTotal;
  const remainingBalance = adjustedContractTotal - totalPaidToDate;

  // Build site address
  const p = invoice.project;
  const siteAddress = p.siteAddress
    ? `${p.siteAddress}${p.siteCity ? `, ${p.siteCity}` : ''}${p.siteState ? `, ${p.siteState}` : ''} ${p.siteZip ?? ''}`.trim()
    : null;

  const billingContactName = [invoice.billingContact.firstName, invoice.billingContact.lastName]
    .filter(Boolean)
    .join(' ');

  const methodLabel = PAID_METHOD_LABELS[invoice.paidMethod ?? ''] ?? invoice.paidMethod ?? 'Other';

  // Render receipt HTML
  const html = renderReceiptHtml({
    invoiceNumber: invoice.invoiceNumber,
    paidDate: invoice.paidAt,
    paidMethod: methodLabel,
    amountPaid: invoice.amount,
    contractorName: 'CPP Painting & Construction LLC',
    contractorAddress: '5401 Longley Lane, Ste C81, Reno, NV 89511',
    contractorPhone: process.env.CONTRACTOR_PHONE ?? '',
    contractorEmail: process.env.PAYMENT_CONTACT_EMAIL ?? 'danny@buildingnv.us',
    contractorLicense: '0092515',
    billingContactName,
    billingCompanyName: invoice.billingCompany?.name ?? null,
    projectName: p.name,
    projectType: p.projectType,
    siteAddress,
    originalContractAmount,
    changeOrderTotal,
    changeOrderCount,
    adjustedContractTotal,
    totalPaidToDate,
    remainingBalance,
    contactName: process.env.PAYMENT_CONTACT_NAME ?? 'Danny Cox',
    contactPhone: process.env.PAYMENT_CONTACT_PHONE ?? '',
    contactEmail: process.env.PAYMENT_CONTACT_EMAIL ?? 'danny@buildingnv.us',
  });

  // Generate PDF buffer
  const pdfBuffer = await generatePDFBuffer(html);

  // Send email with PDF attached
  await sendPaymentReceipt({
    toEmail: contactEmail,
    toName: billingContactName,
    projectTitle: p.name,
    invoiceNumber: invoice.invoiceNumber,
    amount: invoice.amount,
    paidDate: invoice.paidAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    paymentMethod: methodLabel,
    pdfBuffer,
  });
}

/**
 * Generate receipt PDF buffer for download (no email).
 * Returns null if invoice is not paid.
 */
export async function generateReceiptPDF(invoiceId: string): Promise<{ buffer: Buffer; filename: string } | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      billingContact: true,
      billingCompany: true,
      project: true,
      contract: {
        include: {
          changeOrders: { where: { status: 'executed' } },
        },
      },
    },
  });

  if (!invoice || invoice.status !== 'paid' || !invoice.paidAt) return null;

  const paidInvoices = await prisma.invoice.findMany({
    where: { projectId: invoice.projectId, status: 'paid' },
    select: { amount: true },
  });
  const totalPaidToDate = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  const originalContractAmount = invoice.contract.contractAmount ?? 0;
  const changeOrderTotal = invoice.contract.changeOrders.reduce((sum, co) => sum + co.priceDelta, 0);
  const changeOrderCount = invoice.contract.changeOrders.length;
  const adjustedContractTotal = originalContractAmount + changeOrderTotal;
  const remainingBalance = adjustedContractTotal - totalPaidToDate;

  const p = invoice.project;
  const siteAddress = p.siteAddress
    ? `${p.siteAddress}${p.siteCity ? `, ${p.siteCity}` : ''}${p.siteState ? `, ${p.siteState}` : ''} ${p.siteZip ?? ''}`.trim()
    : null;

  const billingContactName = [invoice.billingContact.firstName, invoice.billingContact.lastName]
    .filter(Boolean)
    .join(' ');

  const methodLabel = PAID_METHOD_LABELS[invoice.paidMethod ?? ''] ?? invoice.paidMethod ?? 'Other';

  const html = renderReceiptHtml({
    invoiceNumber: invoice.invoiceNumber,
    paidDate: invoice.paidAt,
    paidMethod: methodLabel,
    amountPaid: invoice.amount,
    contractorName: 'CPP Painting & Construction LLC',
    contractorAddress: '5401 Longley Lane, Ste C81, Reno, NV 89511',
    contractorPhone: process.env.CONTRACTOR_PHONE ?? '',
    contractorEmail: process.env.PAYMENT_CONTACT_EMAIL ?? 'danny@buildingnv.us',
    contractorLicense: '0092515',
    billingContactName,
    billingCompanyName: invoice.billingCompany?.name ?? null,
    projectName: p.name,
    projectType: p.projectType,
    siteAddress,
    originalContractAmount,
    changeOrderTotal,
    changeOrderCount,
    adjustedContractTotal,
    totalPaidToDate,
    remainingBalance,
    contactName: process.env.PAYMENT_CONTACT_NAME ?? 'Danny Cox',
    contactPhone: process.env.PAYMENT_CONTACT_PHONE ?? '',
    contactEmail: process.env.PAYMENT_CONTACT_EMAIL ?? 'danny@buildingnv.us',
  });

  const pdfBuffer = await generatePDFBuffer(html);
  const filename = `${p.name} — Receipt — ${invoice.invoiceNumber}.pdf`;

  return { buffer: pdfBuffer, filename };
}
