// src/lib/docs/msa-template.ts
// Server-only.
// NOTE: This MSA template is boilerplate and has NOT been reviewed by a Nevada attorney.
// It must be reviewed by qualified legal counsel before use in live contracts.
import 'server-only';

export interface MsaOptions {
  clientName: string;
  projectTitle: string;
  projectAddress: string;
  contractorLicense: string;
  effectiveDate: string;
  exhibitATitle: string;
  paymentTerms?: string;
}

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderMsaHtml(opts: MsaOptions): string {
  const payment = opts.paymentTerms ?? '10% due at signing. 25% due after materials purchased. Balance due net 30.';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: serif; color: #111; max-width: 720px; margin: 0 auto; padding: 48px 32px; font-size: 13px; line-height: 1.7; }
  h1 { font-size: 18px; text-align: center; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 4px; }
  .center { text-align: center; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; margin-top: 28px; margin-bottom: 8px; }
  .parties { border: 1px solid #ccc; padding: 16px 20px; margin: 24px 0; font-size: 13px; }
  .sig-block { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-top: 48px; }
  .sig-line { border-top: 1px solid #333; padding-top: 8px; font-size: 12px; color: #555; }
</style>
</head>
<body>

  <h1>Master Service Agreement</h1>
  <p class="center" style="color:#666;font-size:12px;">${esc(opts.effectiveDate)}</p>

  <div class="parties">
    <p><strong>Contractor:</strong> Building NV, LLC, a Nevada limited liability company · ${esc(opts.contractorLicense)}</p>
    <p><strong>Client:</strong> ${esc(opts.clientName)}</p>
    <p><strong>Project:</strong> ${esc(opts.projectTitle)}</p>
    <p><strong>Site Address:</strong> ${esc(opts.projectAddress)}</p>
  </div>

  <h2>1. Scope of Work</h2>
  <p>Contractor shall perform the work described in Exhibit A (Signed Proposal — "${esc(opts.exhibitATitle)}"), which is incorporated herein by reference. The signed proposal constitutes the complete scope of work and pricing for this engagement.</p>

  <h2>2. Payment Terms</h2>
  <p>${esc(payment)} All invoices are due net 30. Interest of 2% per month accrues on overdue balances beginning on the day of delinquency. Client shall not withhold payment for work completed.</p>

  <h2>3. Change Orders</h2>
  <p>Any deviation from the scope in Exhibit A, including unforeseen conditions, owner-requested changes, or material substitutions, requires a written Change Order signed by both parties before work proceeds. Change Orders state the scope change, price adjustment, and any schedule impact. Verbal authorizations are not binding.</p>

  <h2>4. Warranty</h2>
  <p>Contractor warrants workmanship for one (1) year from the date of substantial completion. Warranty covers defects in installation. It does not cover damage from acts of God, earthquake, misuse, non-payment, or conditions outside Contractor's scope. Materials carry manufacturer warranties only.</p>

  <h2>5. Insurance</h2>
  <p>Contractor maintains commercial general liability insurance and workers' compensation coverage as required by Nevada law. Certificates of insurance are available upon request.</p>

  <h2>6. Contractor's License</h2>
  <p>Building NV, LLC holds Nevada Contractor License ${esc(opts.contractorLicense)}. As required by NRS 624, no payment is due for work performed without a valid license. Contractor represents its license is active and in good standing.</p>

  <h2>7. Dispute Resolution</h2>
  <p>Any dispute arising from this Agreement shall be resolved by binding arbitration in Reno, Nevada under the rules of the American Arbitration Association. The prevailing party is entitled to reasonable attorneys' fees. This Agreement is governed by Nevada law.</p>

  <h2>8. Entire Agreement</h2>
  <p>This Agreement and Exhibit A constitute the entire agreement between the parties. No prior representations, warranties, or understandings not contained herein are binding. Amendments must be in writing and signed by both parties.</p>

  <div class="sig-block">
    <div>
      <p style="margin-bottom:48px;"><strong>Client</strong></p>
      <div class="sig-line">Signature</div>
      <div class="sig-line" style="margin-top:16px;">${esc(opts.clientName)} · Date</div>
    </div>
    <div>
      <p style="margin-bottom:48px;"><strong>Building NV, LLC</strong></p>
      <div class="sig-line">Signature</div>
      <div class="sig-line" style="margin-top:16px;">Cody McDannald, Building NV · Date</div>
    </div>
  </div>

  <hr style="margin-top:60px;border:none;border-top:2px solid #ccc;">
  <p style="text-align:center;font-size:11px;color:#888;margin-top:16px;font-family:sans-serif;text-transform:uppercase;letter-spacing:.1em;">Exhibit A follows</p>

</body>
</html>`;
}
