'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface MilestoneOption {
  id: string;
  name: string;
  billingAmount: number | null;
  position: number;
  plannedDate: string | null;
}

interface Props {
  projectId: string;
  contractId: string;
  unbilledMilestones: MilestoneOption[];
  contactOptions: { id: string; name: string; role: string }[];
  companyOptions: { id: string; name: string }[];
  defaultBillingContactId: string | null;
  defaultBillingCompanyId: string | null;
  changeOrders: { id: string; number: number; title: string; priceDelta: number }[];
}

function fmtCurrency(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

export default function CreateInvoiceForm({
  projectId,
  contractId,
  unbilledMilestones,
  contactOptions,
  companyOptions,
  defaultBillingContactId,
  defaultBillingCompanyId,
  changeOrders,
}: Props) {
  const router = useRouter();
  const [selectedMilestones, setSelectedMilestones] = useState<Set<string>>(new Set());
  const [billingContactId, setBillingContactId] = useState(defaultBillingContactId ?? '');
  const [billingCompanyId, setBillingCompanyId] = useState(defaultBillingCompanyId ?? '');
  const [changeOrderId, setChangeOrderId] = useState('');
  const [notes, setNotes] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [customAmount, setCustomAmount] = useState('');
  const [adjustmentNote, setAdjustmentNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const milestoneSum = unbilledMilestones
    .filter((m) => selectedMilestones.has(m.id))
    .reduce((sum, m) => sum + (m.billingAmount ?? 0), 0);

  const effectiveAmount = customAmount ? parseFloat(customAmount) : milestoneSum;
  const amountDiffers = customAmount && Math.abs(parseFloat(customAmount) - milestoneSum) > 0.01;

  const toggleMilestone = (id: string) => {
    setSelectedMilestones((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (selectedMilestones.size === 0) {
      setError('Select at least one milestone to bill.');
      return;
    }
    if (!billingContactId) {
      setError('Select a billing contact.');
      return;
    }
    if (amountDiffers && !adjustmentNote.trim()) {
      setError('Explain why the amount differs from the milestone sum.');
      return;
    }

    setSaving(true);
    setError('');

    const res = await fetch(`/api/projects/${projectId}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contractId,
        milestoneIds: Array.from(selectedMilestones),
        billingContactId,
        billingCompanyId: billingCompanyId || undefined,
        changeOrderId: changeOrderId || undefined,
        issueDate,
        notes: notes || undefined,
        amount: customAmount ? parseFloat(customAmount) : undefined,
        amountAdjustmentNote: amountDiffers ? adjustmentNote : undefined,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Failed to create invoice');
      setSaving(false);
      return;
    }

    const invoice = await res.json();
    router.push(`/internal/projects/${projectId}/invoices/${invoice.id}`);
  };

  return (
    <div className="space-y-6">
      {/* Milestone selection */}
      <section className="border border-border rounded-sm p-6">
        <h2 className="text-text-primary font-semibold mb-4">Select Milestones to Bill</h2>
        {unbilledMilestones.length === 0 ? (
          <p className="text-text-muted text-sm">All milestones have been billed.</p>
        ) : (
          <div className="space-y-2">
            {unbilledMilestones.map((m) => (
              <label
                key={m.id}
                className="flex items-center justify-between p-3 rounded-sm border border-border hover:border-accent/40 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedMilestones.has(m.id)}
                    onChange={() => toggleMilestone(m.id)}
                    className="rounded"
                  />
                  <span className="text-text-primary text-sm">{m.name}</span>
                </div>
                <span className="text-text-muted text-sm">
                  {m.billingAmount != null ? fmtCurrency(m.billingAmount) : '—'}
                </span>
              </label>
            ))}
          </div>
        )}
        {selectedMilestones.size > 0 && (
          <div className="mt-4 pt-4 border-t border-border flex justify-between">
            <span className="text-text-muted text-sm">Milestone total</span>
            <span className="text-text-primary font-semibold">{fmtCurrency(milestoneSum)}</span>
          </div>
        )}
      </section>

      {/* Change order reference */}
      {changeOrders.length > 0 && (
        <section className="border border-border rounded-sm p-6">
          <h2 className="text-text-primary font-semibold mb-4">Change Order Reference (optional)</h2>
          <select
            value={changeOrderId}
            onChange={(e) => setChangeOrderId(e.target.value)}
            className="w-full bg-surface-2 border border-border rounded-sm px-3 py-2 text-sm text-text-primary"
          >
            <option value="">None</option>
            {changeOrders.map((co) => (
              <option key={co.id} value={co.id}>
                CO #{co.number}: {co.title} ({fmtCurrency(co.priceDelta)})
              </option>
            ))}
          </select>
        </section>
      )}

      {/* Billing party */}
      <section className="border border-border rounded-sm p-6">
        <h2 className="text-text-primary font-semibold mb-4">Billing Party</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-text-muted text-xs mb-1 block">Contact</label>
            <select
              value={billingContactId}
              onChange={(e) => setBillingContactId(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-sm px-3 py-2 text-sm text-text-primary"
            >
              <option value="">Select contact...</option>
              {contactOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.role})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-text-muted text-xs mb-1 block">Company</label>
            <select
              value={billingCompanyId}
              onChange={(e) => setBillingCompanyId(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-sm px-3 py-2 text-sm text-text-primary"
            >
              <option value="">None</option>
              {companyOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Dates and notes */}
      <section className="border border-border rounded-sm p-6">
        <h2 className="text-text-primary font-semibold mb-4">Details</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-text-muted text-xs mb-1 block">Issue Date</label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-sm px-3 py-2 text-sm text-text-primary"
            />
          </div>
          <div>
            <label className="text-text-muted text-xs mb-1 block">Due Date</label>
            <p className="text-text-muted text-sm py-2">Net 30 from issue date</p>
          </div>
        </div>
        <div>
          <label className="text-text-muted text-xs mb-1 block">Project Note (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="e.g. Phase 2 — Kitchen renovation"
            className="w-full bg-surface-2 border border-border rounded-sm px-3 py-2 text-sm text-text-primary"
          />
        </div>
      </section>

      {/* Amount override */}
      <section className="border border-border rounded-sm p-6">
        <h2 className="text-text-primary font-semibold mb-4">Amount</h2>
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1">
            <label className="text-text-muted text-xs mb-1 block">
              Invoice Amount (default: milestone sum)
            </label>
            <input
              type="number"
              step="0.01"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder={milestoneSum.toFixed(2)}
              className="w-full bg-surface-2 border border-border rounded-sm px-3 py-2 text-sm text-text-primary"
            />
          </div>
          <div className="text-right pt-4">
            <p className="text-text-primary text-lg font-semibold">{fmtCurrency(effectiveAmount)}</p>
          </div>
        </div>
        {amountDiffers && (
          <div>
            <label className="text-text-muted text-xs mb-1 block">
              Why does the amount differ? (required)
            </label>
            <input
              type="text"
              value={adjustmentNote}
              onChange={(e) => setAdjustmentNote(e.target.value)}
              placeholder="e.g. Discount applied per conversation with client"
              className="w-full bg-surface-2 border border-border rounded-sm px-3 py-2 text-sm text-text-primary"
            />
          </div>
        )}
      </section>

      {/* Submit */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-sm p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={submit}
        disabled={saving || selectedMilestones.size === 0}
        className="w-full bg-accent text-bg font-semibold py-3 rounded-sm text-sm hover:bg-accent/90 transition-colors disabled:opacity-50"
      >
        {saving ? 'Creating Invoice...' : 'Create Invoice'}
      </button>
    </div>
  );
}
