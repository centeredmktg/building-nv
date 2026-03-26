// src/lib/docs/invoice-template.ts
import 'server-only';

interface InvoiceMilestoneData {
  name: string;
  billingAmount: number | null;
  plannedDate: Date | string | null;
  completedAt: Date | string | null;
  isCurrent: boolean; // true if being billed on this invoice
}

interface InvoiceTemplateData {
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  // Contractor info
  contractorName: string;
  contractorAddress: string;
  contractorPhone: string;
  contractorEmail: string;
  contractorLicense: string;
  // Billing party
  billingContactName: string;
  billingCompanyName: string | null;
  // Project
  projectName: string;
  projectType: string | null;
  siteAddress: string | null;
  // Current billing
  billedMilestones: { name: string; description: string | null; amount: number }[];
  changeOrderRef: { number: number; title: string } | null;
  invoiceTotal: number;
  // Project note
  notes: string | null;
  // Financial summary
  originalContractAmount: number;
  changeOrderTotal: number;
  changeOrderCount: number;
  adjustedContractTotal: number;
  previouslyInvoiced: number;
  thisInvoiceAmount: number;
  remainingBalance: number;
  // Milestone schedule
  allMilestones: InvoiceMilestoneData[];
  // Payment instructions
  bankName: string;
  routingNumber: string;
  accountNumber: string;
  paymentContactName: string;
  paymentContactPhone: string;
  paymentContactEmail: string;
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

function fmtDateShort(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function renderInvoiceHtml(data: InvoiceTemplateData): string {
  const billedRows = data.billedMilestones
    .map(
      (m) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${esc(m.name)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#666;">${esc(m.description) || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${fmtCurrency(m.amount)}</td>
    </tr>`
    )
    .join('');

  const milestoneRows = data.allMilestones
    .map((m) => {
      const statusIcon = m.completedAt
        ? `<span style="color:#16a34a;">✓</span>`
        : m.isCurrent
          ? `<span style="color:#d97706;font-weight:600;">● CURRENT</span>`
          : `<span style="color:#9ca3af;">○</span>`;
      const dateStr = m.completedAt ? fmtDateShort(m.completedAt) : fmtDateShort(m.plannedDate);
      const rowBg = m.isCurrent ? 'background:#fefce8;' : '';
      const amountStr = m.billingAmount != null ? fmtCurrency(m.billingAmount) : '—';
      return `
    <tr style="${rowBg}">
      <td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;">${statusIcon}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;">${esc(m.name)}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;">${dateStr}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;text-align:right;">${amountStr}</td>
    </tr>`;
    })
    .join('');

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
  .highlight { background: #eff6ff; padding: 12px; border-radius: 4px; }
  .summary-row { display: flex; justify-content: space-between; padding: 6px 0; }
  .summary-row.bold { font-weight: 700; border-top: 2px solid #1f2937; padding-top: 10px; margin-top: 6px; }
</style>
</head>
<body>

<!-- Header -->
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;">
  <div>
    <h1>INVOICE</h1>
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
      Issued: ${fmtDate(data.issueDate)}<br>
      Due: ${fmtDate(data.dueDate)}
    </p>
  </div>
</div>

<hr class="divider">

<!-- Billing parties -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:32px;">
  <div>
    <h2>From</h2>
    <p style="margin:0;font-weight:600;">${esc(data.contractorName)}</p>
    <p style="margin:2px 0 0;color:#6b7280;font-size:13px;">${esc(data.contractorEmail)}</p>
    <p style="margin:2px 0 0;color:#6b7280;font-size:13px;">${esc(data.contractorPhone)}</p>
  </div>
  <div>
    <h2>Bill To</h2>
    <p style="margin:0;font-weight:600;">${esc(data.billingContactName)}</p>
    ${data.billingCompanyName ? `<p style="margin:2px 0 0;color:#6b7280;font-size:13px;">${esc(data.billingCompanyName)}</p>` : ''}
  </div>
</div>

<!-- Project info -->
<div class="section">
  <h2>Project</h2>
  <p style="margin:0;font-weight:600;">${esc(data.projectName)}</p>
  ${data.projectType ? `<p style="margin:2px 0 0;color:#6b7280;font-size:13px;">${esc(data.projectType)}</p>` : ''}
  ${data.siteAddress ? `<p style="margin:2px 0 0;color:#6b7280;font-size:13px;">${esc(data.siteAddress)}</p>` : ''}
</div>

<hr class="divider">

<!-- Current billing -->
<div class="section">
  <h2>Current Billing</h2>
  ${data.changeOrderRef ? `<p style="color:#666;font-size:13px;margin-bottom:8px;">Change Order #${data.changeOrderRef.number}: ${esc(data.changeOrderRef.title)}</p>` : ''}
  <table>
    <thead>
      <tr style="background:#f9fafb;">
        <th style="padding:8px 12px;text-align:left;font-size:12px;text-transform:uppercase;color:#6b7280;letter-spacing:0.05em;">Milestone</th>
        <th style="padding:8px 12px;text-align:left;font-size:12px;text-transform:uppercase;color:#6b7280;letter-spacing:0.05em;">Description</th>
        <th style="padding:8px 12px;text-align:right;font-size:12px;text-transform:uppercase;color:#6b7280;letter-spacing:0.05em;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${billedRows}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="2" style="padding:12px;text-align:right;font-weight:700;">Invoice Total</td>
        <td style="padding:12px;text-align:right;font-weight:700;font-size:16px;">${fmtCurrency(data.invoiceTotal)}</td>
      </tr>
    </tfoot>
  </table>
</div>

${data.notes ? `
<!-- Project note -->
<div class="section" style="background:#f9fafb;padding:16px;border-radius:4px;">
  <h2>Project Note</h2>
  <p style="margin:0;color:#4b5563;">${esc(data.notes)}</p>
</div>
` : ''}

<hr class="divider">

<!-- Financial summary -->
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
      <span style="color:#6b7280;">Previously Invoiced</span>
      <span>${fmtCurrency(data.previouslyInvoiced)}</span>
    </div>
    <div class="summary-row highlight">
      <span style="font-weight:600;">This Invoice</span>
      <span style="font-weight:600;">${fmtCurrency(data.thisInvoiceAmount)}</span>
    </div>
    <div class="summary-row bold">
      <span>Remaining Balance</span>
      <span>${fmtCurrency(data.remainingBalance)}</span>
    </div>
  </div>
</div>

<hr class="divider">

<!-- Milestone schedule -->
<div class="section">
  <h2>Milestone Schedule</h2>
  <table>
    <thead>
      <tr style="background:#f9fafb;">
        <th style="padding:6px 12px;text-align:left;width:40px;"></th>
        <th style="padding:6px 12px;text-align:left;font-size:12px;text-transform:uppercase;color:#6b7280;">Milestone</th>
        <th style="padding:6px 12px;text-align:left;font-size:12px;text-transform:uppercase;color:#6b7280;">Date</th>
        <th style="padding:6px 12px;text-align:right;font-size:12px;text-transform:uppercase;color:#6b7280;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${milestoneRows}
    </tbody>
  </table>
</div>

<hr class="divider">

<!-- Payment instructions -->
<div class="section">
  <h2>Payment Instructions</h2>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
    <div>
      <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;">Bank</p>
      <p style="margin:0;font-weight:600;">${esc(data.bankName)}</p>
      <p style="margin:8px 0 0;color:#6b7280;font-size:12px;text-transform:uppercase;">Routing</p>
      <p style="margin:0;font-family:monospace;">${esc(data.routingNumber)}</p>
      <p style="margin:8px 0 0;color:#6b7280;font-size:12px;text-transform:uppercase;">Account</p>
      <p style="margin:0;font-family:monospace;">${esc(data.accountNumber)}</p>
    </div>
    <div>
      <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;">Questions?</p>
      <p style="margin:0;font-weight:600;">${esc(data.paymentContactName)}</p>
      <p style="margin:2px 0 0;color:#6b7280;font-size:13px;">${esc(data.paymentContactPhone)}</p>
      <p style="margin:2px 0 0;color:#6b7280;font-size:13px;">${esc(data.paymentContactEmail)}</p>
    </div>
  </div>
</div>

</body>
</html>`;
}

export type { InvoiceTemplateData, InvoiceMilestoneData };
