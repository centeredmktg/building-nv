// src/lib/docs/change-order-template.ts
// Server-only.
import 'server-only';

function esc(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export interface ChangeOrderOptions {
  coNumber: number;
  projectTitle: string;
  clientName: string;
  contractDate: string;
  scopeDelta: string;
  priceDelta: number; // positive = addition, negative = credit
  originalContractAmount: number;
  effectiveDate: string;
}

export function renderChangeOrderHtml(opts: ChangeOrderOptions): string {
  const revised = opts.originalContractAmount + opts.priceDelta;
  const sign = opts.priceDelta >= 0 ? '+' : '';
  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2 });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: sans-serif; color: #111; max-width: 720px; margin: 0 auto; padding: 48px 32px; font-size: 13px; line-height: 1.6; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .meta { color: #666; font-size: 12px; margin-bottom: 32px; }
  .box { border: 1px solid #ccc; padding: 20px 24px; margin: 24px 0; border-radius: 4px; }
  .row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; }
  .row.total { font-weight: bold; font-size: 15px; border-top: 1px solid #ccc; padding-top: 10px; margin-top: 10px; }
  .sig-block { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-top: 48px; }
  .sig-line { border-top: 1px solid #333; padding-top: 8px; font-size: 12px; color: #555; }
  label { font-size: 10px; text-transform: uppercase; letter-spacing: .1em; color: #888; display: block; margin-bottom: 4px; }
</style>
</head>
<body>
  <h1>Change Order #${opts.coNumber}</h1>
  <p class="meta">
    Project: ${esc(opts.projectTitle)} &nbsp;·&nbsp;
    Client: ${esc(opts.clientName)} &nbsp;·&nbsp;
    Original Contract: ${esc(opts.contractDate)} &nbsp;·&nbsp;
    CO Date: ${esc(opts.effectiveDate)}
  </p>

  <div class="box">
    <label>Scope Change</label>
    <p style="margin:0;">${esc(opts.scopeDelta)}</p>
  </div>

  <div class="box">
    <div class="row"><span>Original Contract Amount</span><span>$${fmt(opts.originalContractAmount)}</span></div>
    <div class="row"><span>Change Order Amount</span><span>${sign}$${fmt(Math.abs(opts.priceDelta))}</span></div>
    <div class="row total"><span>Revised Contract Amount</span><span>$${fmt(revised)}</span></div>
  </div>

  <p style="font-size:12px;color:#666;">By signing, both parties authorize the scope change and price adjustment described above. This Change Order is incorporated into the original contract.</p>

  <div class="sig-block">
    <div>
      <p style="margin-bottom:48px;"><strong>Client</strong></p>
      <div class="sig-line">Signature</div>
      <div class="sig-line" style="margin-top:16px;">${esc(opts.clientName)} · Date</div>
    </div>
    <div>
      <p style="margin-bottom:48px;"><strong>Building NV, LLC</strong></p>
      <div class="sig-line">Signature</div>
      <div class="sig-line" style="margin-top:16px;">Building NV · Date</div>
    </div>
  </div>
</body>
</html>`;
}
