// src/lib/docs/email.ts
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
        content: readFileSync(opts.signedPdfPath).toString('base64'),
      },
    ],
  });
}
