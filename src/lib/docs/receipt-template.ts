// src/lib/docs/receipt-template.ts
import 'server-only';

export interface ReceiptTemplateData {
  // Invoice reference
  invoiceNumber: string;
  // Payment details
  paidDate: Date;
  paidMethod: string; // human-readable: "Check", "ACH", "Credit Card", "ACH Bank Transfer"
  amountPaid: number;
  // Contractor info
  contractorName: string;
  contractorAddress: string;
  contractorPhone: string;
  contractorEmail: string;
  contractorLicense: string;
  // Paid by
  billingContactName: string;
  billingCompanyName: string | null;
  // Project
  projectName: string;
  projectType: string | null;
  siteAddress: string | null;
  // Financial summary
  originalContractAmount: number;
  changeOrderTotal: number;
  changeOrderCount: number;
  adjustedContractTotal: number;
  totalPaidToDate: number; // sum of all paid invoices including this one
  remainingBalance: number;
  // Footer contact
  contactName: string;
  contactPhone: string;
  contactEmail: string;
}

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtCurrency(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function renderReceiptHtml(data: ReceiptTemplateData): string {
  const coLine =
    data.changeOrderCount > 0
      ? `<tr>
      <td style="padding:6px 0;color:#666;">Change Orders (${data.changeOrderCount})</td>
      <td style="padding:6px 0;text-align:right;">${fmtCurrency(data.changeOrderTotal)}</td>
    </tr>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    color: #1f2937; max-width: 800px; margin: 0 auto; padding: 48px 40px;
    font-size: 14px; line-height: 1.5;
  }
  h1 { margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.02em; }
  h2 { font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; }
  .section { margin-bottom: 32px; }
  .divider { border: none; border-top: 1px solid #e5e7eb; margin: 32px 0; }
  .summary-row { display: flex; justify-content: space-between; padding: 6px 0; }
  .summary-row.bold { font-weight: 700; border-top: 2px solid #1f2937; padding-top: 10px; margin-top: 6px; }
</style>
</head>
<body>

<!-- Header -->
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;">
  <div>
    <h1>RECEIPT OF PAYMENT</h1>
    <p style="color:#6b7280;font-size:13px;margin:8px 0 0;">
      ${esc(data.contractorName)}<br>
      ${esc(data.contractorAddress)}<br>
      ${esc(data.contractorPhone)}<br>
      License #${esc(data.contractorLicense)}
    </p>
  </div>
  <div style="text-align:right;">
    <p style="font-size:18px;font-weight:700;margin:0;color:#1f2937;">${esc(data.invoiceNumber)}</p>
    <p style="color:#6b7280;font-size:13px;margin:8px 0 0;">
      Payment Date: ${fmtDate(data.paidDate)}
    </p>
  </div>
</div>

<!-- PAID hero block -->
<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:24px;text-align:center;margin-bottom:32px;">
  <div style="display:inline-block;background:#16a34a;color:white;font-size:12px;font-weight:700;letter-spacing:0.1em;padding:4px 16px;border-radius:4px;margin-bottom:12px;">PAID</div>
  <p style="font-size:32px;font-weight:700;margin:8px 0 4px;color:#1f2937;">${fmtCurrency(data.amountPaid)}</p>
  <p style="color:#6b7280;margin:0;font-size:14px;">${fmtDate(data.paidDate)} · ${esc(data.paidMethod)}</p>
</div>

<hr class="divider">

<!-- Parties -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:32px;">
  <div>
    <h2>From</h2>
    <p style="margin:0;font-weight:600;">${esc(data.contractorName)}</p>
    <p style="margin:2px 0 0;color:#6b7280;font-size:13px;">${esc(data.contractorEmail)}</p>
    <p style="margin:2px 0 0;color:#6b7280;font-size:13px;">${esc(data.contractorPhone)}</p>
  </div>
  <div>
    <h2>Paid By</h2>
    <p style="margin:0;font-weight:600;">${esc(data.billingContactName)}</p>
    ${data.billingCompanyName ? `<p style="margin:2px 0 0;color:#6b7280;font-size:13px;">${esc(data.billingCompanyName)}</p>` : ''}
  </div>
</div>

<!-- Project -->
<div class="section">
  <h2>Project</h2>
  <p style="margin:0;font-weight:600;">${esc(data.projectName)}</p>
  ${data.projectType ? `<p style="margin:2px 0 0;color:#6b7280;font-size:13px;">${esc(data.projectType)}</p>` : ''}
  ${data.siteAddress ? `<p style="margin:2px 0 0;color:#6b7280;font-size:13px;">${esc(data.siteAddress)}</p>` : ''}
</div>

<hr class="divider">

<!-- Financial Summary -->
<div class="section">
  <h2>Project Financial Summary</h2>
  <div style="max-width:400px;">
    <div class="summary-row">
      <span style="color:#6b7280;">Original Contract</span>
      <span>${fmtCurrency(data.originalContractAmount)}</span>
    </div>
    ${coLine}
    <div class="summary-row" style="border-top:1px solid #e5e7eb;padding-top:8px;margin-top:4px;">
      <span style="font-weight:600;">Adjusted Contract Total</span>
      <span style="font-weight:600;">${fmtCurrency(data.adjustedContractTotal)}</span>
    </div>
    <div class="summary-row" style="margin-top:12px;">
      <span style="color:#6b7280;">Total Paid to Date</span>
      <span>${fmtCurrency(data.totalPaidToDate)}</span>
    </div>
    <div class="summary-row" style="background:#f0fdf4;padding:8px 12px;border-radius:4px;margin:4px -12px;">
      <span style="font-weight:600;">This Payment</span>
      <span style="font-weight:600;">${fmtCurrency(data.amountPaid)}</span>
    </div>
    <div class="summary-row bold">
      <span>Remaining Balance</span>
      <span>${fmtCurrency(data.remainingBalance)}</span>
    </div>
  </div>
</div>

<hr class="divider">

<!-- Footer -->
<div style="text-align:center;color:#6b7280;font-size:13px;">
  <p style="margin:0 0 8px;font-weight:600;color:#1f2937;">Thank you for your business.</p>
  <p style="margin:0 0 16px;">Please retain this receipt for your records.</p>
  <p style="margin:0;">Questions? Contact ${esc(data.contactName)} · ${esc(data.contactPhone)} · ${esc(data.contactEmail)}</p>
</div>

</body>
</html>`;
}
