// src/lib/docs/quote-template.ts
// Server-only. Never import in client components.
import 'server-only';
import { calculateQuoteTotals } from '@/lib/pricing';
import { resolveQuoteClient } from '@/lib/quote-client';

type QuoteWithRelations = any;

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderQuoteHtml(quote: QuoteWithRelations): string {
  const resolvedClient = resolveQuoteClient(quote);
  const allItems = quote.sections.flatMap((s: any) =>
    s.items.map((i: any) => ({ unitPrice: i.unitPrice, quantity: i.quantity, isMaterial: i.isMaterial }))
  );
  const totals = calculateQuoteTotals(allItems, quote.materialMarkupPct, quote.overheadPct, quote.profitPct);
  const dateStr = new Date(quote.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const lineItemsHtml = quote.sections
    .map(
      (sec: any) => `
    <div style="margin-bottom:24px;">
      <h2 style="font-weight:bold;text-decoration:underline;margin-bottom:12px;">${esc(sec.title)}:</h2>
      ${sec.items
        .map(
          (item: any) => `
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
          <span>— ${esc(item.description)}</span>
          <span>$${(item.quantity * item.unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>`
        )
        .join('')}
    </div>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: sans-serif; color: #111; max-width: 720px; margin: 0 auto; padding: 48px 32px; font-size: 14px; line-height: 1.5; }
  h1 { margin: 0; font-size: 20px; }
  .label { font-size: 10px; text-transform: uppercase; letter-spacing: .1em; color: #888; margin-bottom: 4px; }
  .divider { border: none; border-top: 1px solid #e0e0e0; margin: 24px 0; }
  .total-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; color: #555; }
  .total-final { display: flex; justify-content: space-between; font-weight: bold; font-size: 16px; border-top: 1px solid #ccc; padding-top: 10px; margin-top: 10px; }
</style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid #e0e0e0;">
    <div>
      <h1>Building NV</h1>
      <p style="color:#666;font-size:13px;margin:4px 0 0;">${esc(quote.projectType)} · Reno, Nevada</p>
    </div>
    <div style="text-align:right;">
      <p style="font-size:18px;font-weight:bold;margin:0;">PROPOSAL</p>
      <p style="color:#666;font-size:13px;margin:4px 0 0;">${dateStr}</p>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid #e0e0e0;">
    <div>
      <p class="label">Project</p>
      <p style="font-weight:600;margin:0;">${esc(quote.title)}</p>
      <p style="color:#666;font-size:13px;margin:2px 0 0;">${esc(quote.address)}</p>
    </div>
    <div>
      <p class="label">Client</p>
      <p style="font-weight:600;margin:0;">${esc(resolvedClient.name)}</p>
      ${resolvedClient.company ? `<p style="color:#666;font-size:13px;margin:2px 0 0;">${esc(resolvedClient.company)}</p>` : ''}
    </div>
  </div>

  <p style="color:#555;margin-bottom:32px;">Building NV proposes to perform the following work as outlined below.</p>

  ${lineItemsHtml}

  <hr class="divider">

  ${totals.materialsMarkupAmount > 0 ? `<div class="total-row"><span>Materials Markup (${quote.materialMarkupPct}%)</span><span>$${totals.materialsMarkupAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>` : ''}
  <div class="total-row"><span>Overhead (${quote.overheadPct}%)</span><span>$${totals.overheadAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
  <div class="total-row"><span>Profit (${quote.profitPct}%)</span><span>$${totals.profitAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
  <div class="total-final"><span>Total Cost:</span><span>$${totals.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>

  <hr class="divider">

  <div style="margin-bottom:24px;">
    <h3 style="font-weight:bold;text-decoration:underline;margin-bottom:8px;">Note:</h3>
    <p style="font-size:13px;">${esc(quote.paymentTerms)}</p>
  </div>

  <div style="margin-bottom:24px;">
    <h3 style="font-weight:bold;text-decoration:underline;margin-bottom:8px;">Exclusions</h3>
    <div style="border:1px solid #ccc;padding:12px;font-size:13px;">${esc(quote.exclusions)}</div>
  </div>

  <div style="margin-bottom:40px;font-size:12px;color:#555;">
    <h3 style="font-weight:bold;text-decoration:underline;margin-bottom:8px;font-size:13px;">Terms & Conditions:</h3>
    <p><strong>A.</strong> Interest of 2% per month on overdue accounts.</p>
    <p><strong>B.</strong> Any alteration from above specifications will be charged via written change order.</p>
    <p><strong>C.</strong> All agreements contingent upon strikes, accidents, or delays beyond our control.</p>
    <p><strong>D.</strong> Warranty void by act of God or non-payment. Coverage begins at final payment.</p>
    <p><strong>E.</strong> Unforeseen conditions not included. Additional fees added via change order.</p>
    <p><strong>F.</strong> Payment due net 30 from invoice date.</p>
  </div>

  <div style="margin-top:48px;padding-top:24px;border-top:1px solid #e0e0e0;">
    <p style="font-size:12px;color:#888;">By signing below, you authorize Building NV to proceed with the above scope and agree to the stated terms.</p>
  </div>
</body>
</html>`;
}
