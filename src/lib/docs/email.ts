// src/lib/docs/email.ts
import 'server-only';
import { Resend } from 'resend';
import { readFileSync } from 'fs';

function resend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not set');
  return new Resend(key);
}

const FROM = () =>
  `${process.env.RESEND_FROM_NAME ?? 'Building NV'} <${process.env.RESEND_FROM_EMAIL ?? 'estimates@buildingnv.com'}>`;
const BCC = () => process.env.RESEND_BCC_EMAIL ?? '';

export function buildSigningLinkEmail(opts: {
  recipientFirstName: string;
  projectTitle: string;
  signingUrl: string;
  senderName: string;
  docLabel?: string; // "Proposal" | "Contract" | "Change Order"
}): string {
  const label = opts.docLabel ?? 'Proposal';
  return `
<p>Hi ${opts.recipientFirstName},</p>
<p>Please review and sign the ${label} for <strong>${opts.projectTitle}</strong>:</p>
<p>
  <a href="${opts.signingUrl}"
     style="background:#111110;color:white;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;font-family:sans-serif;">
    Review &amp; Sign ${label}
  </a>
</p>
<p style="color:#666;font-size:13px;">This link expires in 30 days. Reply with any questions.</p>
<p>— ${opts.senderName}<br>Building NV</p>`;
}

export function buildSignedPDFEmail(opts: {
  projectTitle: string;
  senderName: string;
  docLabel?: string;
}): string {
  const label = opts.docLabel ?? 'Proposal';
  return `
<p>Please find your signed ${label} attached for <strong>${opts.projectTitle}</strong>.</p>
<p>We look forward to working with you.</p>
<p>— ${opts.senderName}<br>Building NV</p>`;
}

export async function sendSigningLink(opts: {
  toEmail: string;
  toName: string;
  projectTitle: string;
  signingUrl: string;
  docLabel?: string;
  subject?: string;
}): Promise<void> {
  const label = opts.docLabel ?? 'Proposal';
  const firstName = opts.toName.split(' ')[0] ?? opts.toName;
  const r = resend();
  await r.emails.send({
    from: FROM(),
    to: [opts.toEmail],
    bcc: BCC() ? [BCC()] : [],
    subject: opts.subject ?? `${label} — ${opts.projectTitle}`,
    html: buildSigningLinkEmail({
      recipientFirstName: firstName,
      projectTitle: opts.projectTitle,
      signingUrl: opts.signingUrl,
      senderName: process.env.RESEND_FROM_NAME ?? 'Building NV',
      docLabel: label,
    }),
  });
}

export function buildInvoiceEmail(opts: {
  recipientFirstName: string;
  projectTitle: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string; // formatted date string
  viewUrl: string;
  senderName: string;
}): string {
  const amountStr = `$${opts.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  return `
<p>Hi ${opts.recipientFirstName},</p>
<p>Please find Invoice <strong>${opts.invoiceNumber}</strong> for <strong>${opts.projectTitle}</strong>.</p>
<table style="font-size:14px;margin:16px 0;border-collapse:collapse;">
  <tr><td style="padding:4px 16px 4px 0;color:#666;">Amount</td><td style="font-weight:600;">${amountStr}</td></tr>
  <tr><td style="padding:4px 16px 4px 0;color:#666;">Due Date</td><td>${opts.dueDate}</td></tr>
</table>
<p>
  <a href="${opts.viewUrl}"
     style="background:#111110;color:white;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;font-family:sans-serif;">
    View Invoice
  </a>
</p>
<p style="color:#666;font-size:13px;">A passcode will be sent separately to access the invoice.</p>
<p>— ${opts.senderName}<br>Building NV</p>`;
}

export async function sendInvoiceLink(opts: {
  toEmail: string;
  toName: string;
  projectTitle: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  viewUrl: string;
}): Promise<void> {
  const firstName = opts.toName.split(' ')[0] ?? opts.toName;
  const r = resend();
  await r.emails.send({
    from: FROM(),
    to: [opts.toEmail],
    bcc: BCC() ? [BCC()] : [],
    subject: `Invoice ${opts.invoiceNumber} — ${opts.projectTitle}`,
    html: buildInvoiceEmail({
      recipientFirstName: firstName,
      projectTitle: opts.projectTitle,
      invoiceNumber: opts.invoiceNumber,
      amount: opts.amount,
      dueDate: opts.dueDate,
      viewUrl: opts.viewUrl,
      senderName: process.env.RESEND_FROM_NAME ?? 'Building NV',
    }),
  });
}

export function buildPaymentReceiptEmail(opts: {
  recipientFirstName: string;
  projectTitle: string;
  invoiceNumber: string;
  amount: number;
  paidDate: string;
  paymentMethod: string;
  senderName: string;
}): string {
  const amountStr = `$${opts.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  return `
<p>Hi ${opts.recipientFirstName},</p>
<p>This confirms your payment has been received for <strong>${opts.projectTitle}</strong>.</p>
<table style="font-size:14px;margin:16px 0;border-collapse:collapse;">
  <tr><td style="padding:4px 16px 4px 0;color:#666;">Invoice</td><td style="font-weight:600;">${opts.invoiceNumber}</td></tr>
  <tr><td style="padding:4px 16px 4px 0;color:#666;">Amount</td><td style="font-weight:600;">${amountStr}</td></tr>
  <tr><td style="padding:4px 16px 4px 0;color:#666;">Date Paid</td><td>${opts.paidDate}</td></tr>
  <tr><td style="padding:4px 16px 4px 0;color:#666;">Method</td><td>${opts.paymentMethod}</td></tr>
</table>
<p style="color:#666;font-size:13px;">Please retain this email for your records. If you have any questions, reply to this email.</p>
<p>Thank you for your business.</p>
<p>— ${opts.senderName}<br>Building NV</p>`;
}

export async function sendPaymentReceipt(opts: {
  toEmail: string;
  toName: string;
  projectTitle: string;
  invoiceNumber: string;
  amount: number;
  paidDate: string;
  paymentMethod: string;
}): Promise<void> {
  const firstName = opts.toName.split(' ')[0] ?? opts.toName;
  const r = resend();
  await r.emails.send({
    from: FROM(),
    to: [opts.toEmail],
    bcc: BCC() ? [BCC()] : [],
    subject: `Payment Receipt — ${opts.invoiceNumber} — ${opts.projectTitle}`,
    html: buildPaymentReceiptEmail({
      recipientFirstName: firstName,
      projectTitle: opts.projectTitle,
      invoiceNumber: opts.invoiceNumber,
      amount: opts.amount,
      paidDate: opts.paidDate,
      paymentMethod: opts.paymentMethod,
      senderName: process.env.RESEND_FROM_NAME ?? 'Building NV',
    }),
  });
}

export async function sendSignedPDF(opts: {
  toEmail: string;
  toName: string;
  projectTitle: string;
  signedPdfPath: string;
  docLabel?: string;
  subject?: string;
}): Promise<void> {
  const label = opts.docLabel ?? 'Proposal';
  const r = resend();
  await r.emails.send({
    from: FROM(),
    to: [opts.toEmail],
    bcc: BCC() ? [BCC()] : [],
    subject: opts.subject ?? `Signed ${label} — ${opts.projectTitle}`,
    html: buildSignedPDFEmail({
      projectTitle: opts.projectTitle,
      senderName: process.env.RESEND_FROM_NAME ?? 'Building NV',
      docLabel: label,
    }),
    attachments: [
      {
        filename: `${opts.projectTitle} — Signed ${label}.pdf`,
        content: readFileSync(opts.signedPdfPath),
      },
    ],
  });
}
