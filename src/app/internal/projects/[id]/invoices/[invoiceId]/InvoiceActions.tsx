'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function InvoiceActions({
  invoiceId,
  projectId,
  status,
  passcode,
}: {
  invoiceId: string;
  projectId: string;
  status: string;
  passcode: string | null;
}) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [marking, setMarking] = useState(false);
  const [paidMethod, setPaidMethod] = useState('check');
  const [error, setError] = useState('');
  const [sendResult, setSendResult] = useState<{ passcode: string; message: string } | null>(null);

  const sendInvoice = async () => {
    setSending(true);
    setError('');
    const res = await fetch(`/api/invoices/${invoiceId}/send`, { method: 'POST' });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Failed to send');
      setSending(false);
      return;
    }
    const data = await res.json();
    setSendResult(data);
    setSending(false);
    router.refresh();
  };

  const markPaid = async () => {
    setMarking(true);
    setError('');
    const res = await fetch(`/api/invoices/${invoiceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'paid', paidMethod }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Failed to update');
      setMarking(false);
      return;
    }
    setMarking(false);
    router.refresh();
  };

  return (
    <section className="border border-border rounded-sm p-6">
      <h2 className="text-text-primary font-semibold mb-4">Actions</h2>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-sm p-3 text-red-400 text-sm mb-4">
          {error}
        </div>
      )}

      {sendResult && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-sm p-4 mb-4">
          <p className="text-green-400 text-sm font-medium">Invoice sent!</p>
          <p className="text-text-primary text-sm mt-1">
            Passcode to share with client: <code className="bg-surface-2 px-2 py-0.5 rounded text-lg font-mono font-bold">{sendResult.passcode}</code>
          </p>
          <p className="text-text-muted text-xs mt-1">Share this passcode via text or phone — not in the same email.</p>
        </div>
      )}

      {passcode && status !== 'draft' && !sendResult && (
        <div className="bg-surface-2 rounded-sm p-3 mb-4">
          <p className="text-text-muted text-xs">Client Passcode</p>
          <p className="text-text-primary font-mono font-bold text-lg">{passcode}</p>
        </div>
      )}

      <div className="flex gap-3">
        {(status === 'draft' || status === 'sent') && (
          <button
            onClick={sendInvoice}
            disabled={sending}
            className="bg-accent text-bg font-semibold px-4 py-2 rounded-sm text-sm hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {sending ? 'Sending...' : status === 'sent' ? 'Resend Invoice' : 'Send Invoice'}
          </button>
        )}

        {status !== 'paid' && (
          <div className="flex items-center gap-2">
            <select
              value={paidMethod}
              onChange={(e) => setPaidMethod(e.target.value)}
              className="bg-surface-2 border border-border rounded-sm px-3 py-2 text-sm text-text-primary"
            >
              <option value="check">Check</option>
              <option value="ach">ACH</option>
              <option value="other">Other</option>
            </select>
            <button
              onClick={markPaid}
              disabled={marking}
              className="border border-green-500/50 text-green-400 font-semibold px-4 py-2 rounded-sm text-sm hover:bg-green-500/10 transition-colors disabled:opacity-50"
            >
              {marking ? 'Updating...' : 'Mark Paid'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
