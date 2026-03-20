"use client";

import { useState, useCallback } from "react";
import { calculateQuoteTotals } from "@/lib/pricing";

const UNITS = ["ea", "SF", "LF", "LS", "hr"];

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
  paymentTerms: string;
  exclusions: string;
  notes: string;
  estimatedStartDate: string | null;
  estimatedDuration: string | null;
  client: { name: string; company: string };
  sections: Section[];
}

export default function QuoteEditor({ quote: initial }: { quote: Quote }) {
  const [quote, setQuote] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
          items: [...s.items, { description: "", quantity: 1, unit: "ea", unitPrice: 0, isMaterial: false }],
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

  const markSent = async () => {
    const link = `${window.location.origin}/proposals/${quote.slug}`;
    await navigator.clipboard.writeText(link);
    await fetch(`/api/quotes/${quote.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...quote, status: "sent" }),
    });
    setQuote((q) => ({ ...q, status: "sent" }));
    alert(`Proposal link copied to clipboard:\n${link}`);
  };

  const inputClass = "bg-transparent border border-transparent hover:border-border focus:border-accent rounded px-2 py-1 text-sm text-text-primary focus:outline-none transition-colors w-full";

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
      {/* Line items — takes 3 cols */}
      <div className="xl:col-span-3">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-text-primary">{quote.title}</h1>
            <p className="text-text-muted text-sm">{quote.client.name}{quote.client.company ? ` · ${quote.client.company}` : ""}</p>
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
            <button onClick={markSent}
              className="bg-accent text-bg font-semibold px-4 py-2 rounded-sm text-sm hover:bg-accent/90 transition-colors">
              Send to Client
            </button>
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
                    <div className="col-span-2">
                      <input type="number" value={item.unitPrice}
                        onChange={(e) => updateItem(si, ii, "unitPrice", parseFloat(e.target.value) || 0)}
                        className={`${inputClass} text-right`} />
                    </div>
                    <div className="col-span-2 text-right text-sm text-text-primary font-medium pr-2">
                      ${(item.quantity * item.unitPrice).toFixed(2)}
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

          <div className="flex flex-col gap-3 text-sm mb-4">
            <div className="flex justify-between">
              <span className="text-text-muted">Subtotal</span>
              <span className="text-text-primary">${totals.subtotal.toFixed(2)}</span>
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
              <span className="text-accent font-bold text-lg">${totals.total.toFixed(2)}</span>
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

          <div className="border-t border-border pt-4 flex flex-col gap-2">
            <span className={`text-xs border px-2 py-1 rounded-full text-center uppercase tracking-wide ${
              quote.status === "accepted" ? "text-green-400 border-green-400" :
              quote.status === "sent" ? "text-accent border-accent" :
              "text-text-muted border-border"
            }`}>
              {quote.status}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
