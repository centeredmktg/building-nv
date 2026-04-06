"use client";

import { useState, useCallback } from "react";
import { calculateQuoteTotals } from "@/lib/pricing";
import { resolveQuoteClient } from "@/lib/quote-client";
import { generateMilestones } from "@/lib/milestone-defaults";

const UNITS = ["ea", "SF", "LF", "LS", "hr"];

const SECTION_DEFAULT_UNITS: Record<string, string> = {
  demolition: "LS",
  flooring: "SF",
  ceiling: "SF",
  "paint & drywall": "SF",
  painting: "SF",
  drywall: "SF",
  framing: "LF",
  electrical: "ea",
  plumbing: "ea",
  tile: "SF",
  insulation: "SF",
  roofing: "SF",
  siding: "SF",
  cabinets: "ea",
  countertops: "SF",
  "finish carpentry": "LF",
};

function defaultUnitForSection(title: string): string {
  const key = title.toLowerCase().trim();
  for (const [section, unit] of Object.entries(SECTION_DEFAULT_UNITS)) {
    if (key.includes(section) || section.includes(key)) return unit;
  }
  return "ea";
}

interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  isMaterial: boolean;
}

interface Section {
  id?: string;
  title: string;
  items: LineItem[];
}

interface Milestone {
  id?: string;
  name: string;
  weekNumber: number;
  duration: string | null;
  paymentPct: number | null;
  paymentLabel: string | null;
}

interface Quote {
  id: string;
  slug: string;
  title: string;
  address: string;
  projectType: string;
  status: string;
  materialMarkupPct: number;
  overheadPct: number;
  profitPct: number;
  paddingPct: number;
  paymentTerms: string;
  exclusions: string;
  notes: string;
  estimatedStartDate: string | null;
  estimatedDuration: string | null;
  quoteContacts: { role: string; contact: { firstName: string; lastName?: string | null; email?: string | null } }[];
  quoteCompanies: { company: { name: string } }[];
  sections: Section[];
  milestones: Milestone[];
  signingToken?: string | null;
  signedAt?: string | Date | null;
  signedPdfPath?: string | null;
  contract?: {
    id: string;
    status: string;
    signedAt?: string | Date | null;
    signedPdfPath?: string | null;
    contractAmount?: number | null;
    changeOrders: Array<{
      id: string;
      number: number;
      title: string;
      priceDelta: number;
      status: string;
      signedAt?: string | Date | null;
      signedPdfPath?: string | null;
    }>;
  } | null;
}

export default function QuoteEditor({ quote: initial }: { quote: Quote }) {
  const [quote, setQuote] = useState({ ...initial, milestones: initial.milestones ?? [] });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sending, setSending] = useState(false);

  const allItems = quote.sections.flatMap((s) => s.items);
  const totals = calculateQuoteTotals(
    allItems,
    quote.materialMarkupPct,
    quote.overheadPct,
    quote.profitPct
  );

  const updateItem = (si: number, ii: number, field: keyof LineItem, value: string | number | boolean) => {
    setQuote((q) => {
      const sections = q.sections.map((s, sIdx) =>
        sIdx !== si ? s : {
          ...s,
          items: s.items.map((item, iIdx) =>
            iIdx !== ii ? item : { ...item, [field]: value }
          ),
        }
      );
      return { ...q, sections };
    });
  };

  const addItem = (si: number) => {
    setQuote((q) => ({
      ...q,
      sections: q.sections.map((s, sIdx) =>
        sIdx !== si ? s : {
          ...s,
          items: [...s.items, { description: "", quantity: 1, unit: defaultUnitForSection(s.title), unitPrice: 0, isMaterial: false }],
        }
      ),
    }));
  };

  const removeItem = (si: number, ii: number) => {
    setQuote((q) => ({
      ...q,
      sections: q.sections.map((s, sIdx) =>
        sIdx !== si ? s : { ...s, items: s.items.filter((_, iIdx) => iIdx !== ii) }
      ),
    }));
  };

  const addSection = () => {
    setQuote((q) => ({
      ...q,
      sections: [...q.sections, { title: "New Section", items: [] }],
    }));
  };

  const updateMilestone = (idx: number, field: keyof Milestone, value: string | number | null) => {
    setQuote((q) => ({
      ...q,
      milestones: q.milestones.map((m, i) =>
        i !== idx ? m : { ...m, [field]: value }
      ),
    }));
  };

  const regenerateMilestones = () => {
    if (!confirm("Regenerate milestones from current sections? This will replace all existing milestones.")) return;
    const generated = generateMilestones(quote.sections.map((s) => ({ title: s.title })));
    setQuote((q) => ({
      ...q,
      milestones: generated.map((m) => ({
        name: m.name,
        weekNumber: m.weekNumber,
        duration: m.duration,
        paymentPct: m.paymentPct,
        paymentLabel: m.paymentLabel,
      })),
    }));
  };

  const save = useCallback(async () => {
    setSaving(true);
    await fetch(`/api/quotes/${quote.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(quote),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [quote]);

  const sendForSignature = async () => {
    if (!confirm(`Send signing link to ${resolveQuoteClient(quote).name}?`)) return;
    setSending(true);
    try {
      const res = await fetch(`/api/quotes/${quote.id}/send`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? 'Failed to send signing link');
        return;
      }
      setQuote((q) => ({ ...q, status: 'sent' }));
      if (!data.emailSent) {
        alert(`Email delivery failed. Signing link (copy manually):\n${data.signingUrl}`);
      } else {
        alert(`Signing link sent to ${resolveQuoteClient(quote).name}.\n\nLink: ${data.signingUrl}`);
      }
    } catch (err: unknown) {
      console.error('sendForSignature error:', err);
      alert('Network error — could not send signing link. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  const inputClass = "bg-transparent border border-transparent hover:border-border focus:border-accent rounded px-2 py-1 text-sm text-text-primary focus:outline-none transition-colors w-full";

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
      {/* Line items — takes 3 cols */}
      <div className="xl:col-span-3">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-text-primary">{quote.title}</h1>
            <p className="text-text-muted text-sm">{(() => { const c = resolveQuoteClient(quote); return c.name + (c.company ? ` · ${c.company}` : ""); })()}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={save} disabled={saving}
              className="border border-border text-text-primary px-4 py-2 rounded-sm text-sm hover:border-text-muted transition-colors disabled:opacity-60">
              {saving ? "Saving..." : saved ? "Saved" : "Save"}
            </button>
            <a href={`/proposals/${quote.slug}`} target="_blank"
              className="border border-border text-text-primary px-4 py-2 rounded-sm text-sm hover:border-text-muted transition-colors">
              Preview
            </a>
            {quote.status === 'draft' || quote.status === 'sent' ? (
              <button
                onClick={sendForSignature}
                disabled={sending}
                className="bg-accent text-bg font-semibold px-4 py-2 rounded-sm text-sm hover:bg-accent/90 transition-colors disabled:opacity-60"
              >
                {sending ? 'Sending...' : quote.status === 'sent' ? 'Resend Link' : 'Send for Signature'}
              </button>
            ) : null}
            {quote.status === 'quote_signed' && !quote.contract ? (
              <ConvertToContractButton quoteId={quote.id} saved={saved} />
            ) : null}
          </div>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-12 gap-2 px-3 mb-1 text-xs text-text-muted uppercase tracking-widest">
          <span className="col-span-5">Description</span>
          <span className="col-span-1 text-right">Qty</span>
          <span className="col-span-1">Unit</span>
          <span className="col-span-2 text-right">Unit Price</span>
          <span className="col-span-2 text-right">Total</span>
          <span className="col-span-1" />
        </div>

        <div className="flex flex-col gap-4">
          {quote.sections.map((sec, si) => (
            <div key={si} className="border border-border rounded-sm">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface">
                <input
                  value={sec.title}
                  onChange={(e) => setQuote((q) => ({
                    ...q,
                    sections: q.sections.map((s, i) => i === si ? { ...s, title: e.target.value } : s),
                  }))}
                  className="bg-transparent text-text-primary font-medium text-sm focus:outline-none flex-1"
                />
              </div>
              <div className="divide-y divide-border">
                {sec.items.map((item, ii) => (
                  <div key={ii} className="grid grid-cols-12 gap-2 px-3 py-2 items-center group">
                    <div className="col-span-5">
                      <input value={item.description}
                        onChange={(e) => updateItem(si, ii, "description", e.target.value)}
                        className={inputClass} placeholder="Description" />
                    </div>
                    <div className="col-span-1">
                      <input type="number" value={item.quantity}
                        onChange={(e) => updateItem(si, ii, "quantity", parseFloat(e.target.value) || 0)}
                        className={`${inputClass} text-right`} />
                    </div>
                    <div className="col-span-1">
                      <select value={item.unit}
                        onChange={(e) => updateItem(si, ii, "unit", e.target.value)}
                        className="bg-surface border border-border rounded px-1 py-1 text-sm text-text-primary focus:outline-none focus:border-accent w-full">
                        {UNITS.map((u) => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2 flex items-center">
                      <span className="text-text-muted text-sm mr-0.5 select-none">$</span>
                      <input type="number" value={item.unitPrice}
                        onChange={(e) => updateItem(si, ii, "unitPrice", parseFloat(e.target.value) || 0)}
                        className={`${inputClass} text-right flex-1`} />
                    </div>
                    <div className="col-span-2 text-right text-sm text-text-primary font-medium pr-2">
                      ${(item.quantity * item.unitPrice).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="col-span-1 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => removeItem(si, ii)}
                        className="text-text-muted hover:text-red-400 text-xs px-1">✕</button>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => addItem(si)}
                className="w-full py-2 text-xs text-text-muted hover:text-accent transition-colors border-t border-border">
                + Add Line Item
              </button>
            </div>
          ))}
          <button onClick={addSection}
            className="border border-dashed border-border rounded-sm py-3 text-sm text-text-muted hover:border-accent hover:text-accent transition-colors">
            + Add Section
          </button>
        </div>
      </div>

      {/* Summary panel — 1 col */}
      <div className="xl:col-span-1">
        <div className="border border-border rounded-sm p-4 sticky top-6">
          <h2 className="text-text-primary font-semibold text-sm mb-4">Quote Summary</h2>

          {/* Padding — hidden markup baked into unit prices */}
          <div className="bg-surface-2 rounded px-3 py-2.5 mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-text-muted text-xs font-medium uppercase tracking-wide">Padding</span>
              {quote.paddingPct > 0 && (
                <span className="text-[10px] text-amber-400">Applied: {quote.paddingPct}%</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                id="padding-input"
                defaultValue=""
                placeholder="0"
                step="0.5"
                className="w-16 bg-surface border border-border rounded px-2 py-1 text-sm text-text-primary text-right focus:outline-none focus:border-accent"
              />
              <span className="text-text-muted text-xs">%</span>
              <button
                onClick={() => {
                  const input = document.getElementById("padding-input") as HTMLInputElement;
                  const pct = parseFloat(input.value);
                  if (!pct || pct === 0) return;
                  if (!confirm(`Apply ${pct}% padding to all unit prices? This will multiply every price by ${(1 + pct / 100).toFixed(4)}.`)) return;
                  setQuote((q) => ({
                    ...q,
                    paddingPct: pct,
                    sections: q.sections.map((s) => ({
                      ...s,
                      items: s.items.map((item) => ({
                        ...item,
                        unitPrice: Math.round(item.unitPrice * (1 + pct / 100) * 100) / 100,
                      })),
                    })),
                  }));
                  input.value = "";
                }}
                className="text-xs text-accent hover:text-accent/80 font-medium transition-colors"
              >
                Apply
              </button>
            </div>
            <p className="text-[10px] text-text-muted mt-1.5">Multiplies all unit prices. Not shown on invoice.</p>
          </div>

          <div className="flex flex-col gap-3 text-sm mb-4">
            <div className="flex justify-between">
              <span className="text-text-muted">Subtotal</span>
              <span className="text-text-primary">${totals.subtotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Materials markup</span>
              <div className="flex items-center gap-1">
                <input type="number" value={quote.materialMarkupPct}
                  onChange={(e) => setQuote((q) => ({ ...q, materialMarkupPct: parseFloat(e.target.value) || 0 }))}
                  className="w-12 bg-surface border border-border rounded px-1 py-0.5 text-xs text-text-primary text-right focus:outline-none focus:border-accent" />
                <span className="text-text-muted text-xs">%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Overhead</span>
              <div className="flex items-center gap-1">
                <input type="number" value={quote.overheadPct}
                  onChange={(e) => setQuote((q) => ({ ...q, overheadPct: parseFloat(e.target.value) || 0 }))}
                  className="w-12 bg-surface border border-border rounded px-1 py-0.5 text-xs text-text-primary text-right focus:outline-none focus:border-accent" />
                <span className="text-text-muted text-xs">%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Profit</span>
              <div className="flex items-center gap-1">
                <input type="number" value={quote.profitPct}
                  onChange={(e) => setQuote((q) => ({ ...q, profitPct: parseFloat(e.target.value) || 0 }))}
                  className="w-12 bg-surface border border-border rounded px-1 py-0.5 text-xs text-text-primary text-right focus:outline-none focus:border-accent" />
                <span className="text-text-muted text-xs">%</span>
              </div>
            </div>
            <div className="border-t border-border pt-3 flex justify-between">
              <span className="text-text-primary font-semibold">Total</span>
              <span className="text-accent font-bold text-lg">${totals.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Project Timeline */}
          <div className="border-t border-border pt-4 mt-4">
            <h3 className="text-text-muted text-xs font-semibold uppercase tracking-widest mb-3">
              Project Timeline
            </h3>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-text-muted text-xs mb-1 block">Est. Start Date</label>
                <input
                  type="date"
                  value={quote.estimatedStartDate?.split("T")[0] ?? ""}
                  onChange={(e) =>
                    setQuote((q) => ({ ...q, estimatedStartDate: e.target.value || null }))
                  }
                  className="w-full bg-surface-2 border border-border rounded-sm px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div className="flex-1">
                <label className="text-text-muted text-xs mb-1 block">Est. Duration</label>
                <input
                  type="text"
                  value={quote.estimatedDuration ?? ""}
                  onChange={(e) =>
                    setQuote((q) => ({ ...q, estimatedDuration: e.target.value || null }))
                  }
                  placeholder="e.g. 8 weeks"
                  className="w-full bg-surface-2 border border-border rounded-sm px-3 py-2 text-sm text-text-primary"
                />
              </div>
            </div>
          </div>

          {/* Milestone Editor */}
          <div className="border-t border-border pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-text-muted text-xs font-semibold uppercase tracking-widest">
                Milestones &amp; Payments
              </h3>
              <button
                onClick={regenerateMilestones}
                className="text-[10px] text-accent hover:text-accent/80 transition-colors"
              >
                Regenerate
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {quote.milestones.map((m, idx) => (
                <div key={idx} className="bg-surface-2 rounded px-2.5 py-2 text-xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-text-primary font-medium truncate flex-1 mr-2">{m.name}</span>
                    <input
                      type="number"
                      value={m.weekNumber}
                      onChange={(e) => updateMilestone(idx, "weekNumber", parseInt(e.target.value) || 0)}
                      className="w-10 bg-surface border border-border rounded px-1 py-0.5 text-[10px] text-text-primary text-center focus:outline-none focus:border-accent"
                      title="Week"
                    />
                    <span className="text-text-muted text-[10px] ml-1">wk</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={m.duration ?? ""}
                      onChange={(e) => updateMilestone(idx, "duration", e.target.value || null)}
                      placeholder="Duration"
                      className="flex-1 bg-surface border border-border rounded px-1.5 py-0.5 text-[10px] text-text-primary focus:outline-none focus:border-accent"
                    />
                    <input
                      type="number"
                      value={m.paymentPct ?? ""}
                      onChange={(e) => updateMilestone(idx, "paymentPct", e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder="%"
                      className="w-12 bg-surface border border-border rounded px-1 py-0.5 text-[10px] text-text-primary text-right focus:outline-none focus:border-accent"
                    />
                    <span className="text-text-muted text-[10px]">%</span>
                  </div>
                </div>
              ))}
            </div>

            {quote.milestones.length > 0 && (() => {
              const totalPct = quote.milestones.reduce((sum, m) => sum + (m.paymentPct ?? 0), 0);
              const isValid = Math.abs(totalPct - 100) < 0.01;
              return (
                <div className={`mt-2 text-[10px] text-right font-medium ${
                  isValid ? "text-green-400" : totalPct > 100 ? "text-red-400" : "text-amber-400"
                }`}>
                  Payment total: {totalPct}%{!isValid && (totalPct > 100 ? " (over 100%)" : " (under 100%)")}
                </div>
              );
            })()}
          </div>

          <div className="border-t border-border pt-4 flex flex-col gap-2">
            <span className={`text-xs border px-2 py-1 rounded-full text-center uppercase tracking-wide ${
              quote.status === 'quote_signed' ? 'text-green-400 border-green-400' :
              quote.status === 'sent' ? 'text-accent border-accent' :
              'text-text-muted border-border'
            }`}>
              {quote.status === 'quote_signed' ? 'Signed' : quote.status}
            </span>
          </div>

          {/* Document history */}
          {(quote.signedAt || quote.contract) && (
            <div className="border-t border-border pt-4 mt-2">
              <h3 className="text-text-muted text-xs font-semibold uppercase tracking-widest mb-3">Documents</h3>
              <div className="flex flex-col gap-2 text-xs">
                {quote.signedAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-text-muted">Quote signed</span>
                    <div className="flex items-center gap-2">
                      <span className="text-green-400">✓ {new Date(quote.signedAt).toLocaleDateString()}</span>
                      {quote.signedPdfPath && (
                        <a href={`/api/quotes/${quote.id}/signed-pdf`} target="_blank" className="text-accent underline text-xs">Download PDF</a>
                      )}
                    </div>
                  </div>
                )}
                {quote.contract && (
                  <div className="flex justify-between items-center">
                    <span className="text-text-muted">Contract</span>
                    <div className="flex items-center gap-2">
                      <span className={quote.contract.status === 'executed' ? 'text-green-400' : 'text-accent'}>
                        {quote.contract.status === 'executed' ? '✓ Executed' : quote.contract.status}
                      </span>
                      {quote.contract.signedPdfPath && (
                        <a href={`/api/contracts/${quote.contract.id}/signed-pdf`} target="_blank" className="text-accent underline text-xs">Download PDF</a>
                      )}
                    </div>
                  </div>
                )}
                {quote.contract?.changeOrders?.map((co) => (
                  <div key={co.id} className="flex justify-between items-center">
                    <span className="text-text-muted">CO #{co.number}</span>
                    <div className="flex items-center gap-2">
                      <span className={co.status === 'executed' ? 'text-green-400' : 'text-accent'}>
                        {co.status === 'executed' ? '✓' : co.status} {co.priceDelta >= 0 ? '+' : ''}{co.priceDelta.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })}
                      </span>
                      {co.signedPdfPath && (
                        <a href={`/api/change-orders/${co.id}/signed-pdf`} target="_blank" className="text-accent underline text-xs ml-2">Download PDF</a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ConvertToContractButton({ quoteId, saved }: { quoteId: string; saved: boolean }) {
  const [loading, setLoading] = useState(false);

  const convert = async () => {
    if (!saved && !confirm("You have unsaved changes. Convert anyway? Unsaved changes will be lost.")) return;
    if (!confirm("Convert this signed quote to a contract?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/convert-to-contract`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Failed to create contract");
        return;
      }
      window.location.reload();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={convert}
      disabled={loading}
      className="bg-green-700 text-white font-semibold px-4 py-2 rounded-sm text-sm hover:bg-green-600 transition-colors disabled:opacity-60"
    >
      {loading ? "Creating..." : "Convert to Contract"}
    </button>
  );
}
