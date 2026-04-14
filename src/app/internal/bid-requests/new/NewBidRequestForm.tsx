"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TRADES } from "@/lib/trades";

interface QuoteSection {
  id: string;
  title: string;
  trade: string | null;
  items: { id: string; description: string; quantity: number; unit: string; trade: string | null }[];
}

interface QuoteOption {
  id: string;
  title: string;
  projectType: string;
  address: string;
  sections: QuoteSection[];
}

interface SubOption {
  profileId: string;
  companyId: string;
  companyName: string;
  trades: string[];
  bidLimit: number | null;
}

interface Props {
  quotes: QuoteOption[];
  subs: SubOption[];
}

export default function NewBidRequestForm({ quotes, subs }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [requiredTrade, setRequiredTrade] = useState("");
  const [responseDeadline, setResponseDeadline] = useState("");
  const [startWindow, setStartWindow] = useState("");
  const [specialRequirements, setSpecialRequirements] = useState("");
  const [selectedSubIds, setSelectedSubIds] = useState<string[]>([]);

  const inputClass = "w-full border border-border rounded-sm px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand";

  const selectedQuote = quotes.find((q) => q.id === selectedQuoteId);

  const matchingSubs = requiredTrade
    ? subs.filter((s) => s.trades.includes(requiredTrade))
    : subs;

  const toggleItem = (itemId: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId],
    );
  };

  const toggleAllInSection = (section: QuoteSection) => {
    const sectionItemIds = section.items.map((i) => i.id);
    const allSelected = sectionItemIds.every((id) => selectedItemIds.includes(id));
    if (allSelected) {
      setSelectedItemIds((prev) => prev.filter((id) => !sectionItemIds.includes(id)));
    } else {
      setSelectedItemIds((prev) => [...new Set([...prev, ...sectionItemIds])]);
    }
  };

  const toggleSub = (companyId: string) => {
    setSelectedSubIds((prev) =>
      prev.includes(companyId) ? prev.filter((id) => id !== companyId) : [...prev, companyId],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const brRes = await fetch("/api/bid-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId: selectedQuoteId,
          lineItemIds: selectedItemIds,
          requiredTrade,
          responseDeadline,
          startWindow,
          specialRequirements,
        }),
      });

      if (!brRes.ok) {
        const data = await brRes.json();
        throw new Error(data.error || "Failed to create bid request");
      }

      const bidRequest = await brRes.json();

      if (selectedSubIds.length > 0) {
        const invRes = await fetch(`/api/bid-requests/${bidRequest.id}/invitations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subcontractorIds: selectedSubIds }),
        });

        if (!invRes.ok) {
          const data = await invRes.json();
          throw new Error(data.error || "Failed to send invitations");
        }
      }

      router.push(`/internal/bid-requests/${bidRequest.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-sm text-sm">{error}</div>}

      <section className="border border-border rounded-sm p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Source Quote</h2>
        {quotes.length === 0 ? (
          <p className="text-text-muted text-sm">No quotes available. Only quotes marked as <strong>sent</strong> or <strong>signed</strong> can be used for bid requests.</p>
        ) : (
          <select className={inputClass} value={selectedQuoteId} onChange={(e) => { setSelectedQuoteId(e.target.value); setSelectedItemIds([]); }} required>
            <option value="">Select a quote…</option>
            {quotes.map((q) => (
              <option key={q.id} value={q.id}>{q.title} — {q.projectType}</option>
            ))}
          </select>
        )}
      </section>

      {selectedQuote && (
        <section className="border border-border rounded-sm p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Select Scope Items</h2>
          <div className="space-y-4">
            {selectedQuote.sections.map((section) => (
              <div key={section.id}>
                <label className="flex items-center gap-2 text-sm font-medium text-text-primary cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={section.items.every((i) => selectedItemIds.includes(i.id))}
                    onChange={() => toggleAllInSection(section)}
                    className="rounded border-border"
                  />
                  {section.title}
                  {section.trade && <span className="text-text-muted text-xs">({section.trade})</span>}
                </label>
                <div className="ml-6 space-y-1">
                  {section.items.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedItemIds.includes(item.id)}
                        onChange={() => toggleItem(item.id)}
                        className="rounded border-border"
                      />
                      {item.description} — {item.quantity} {item.unit}
                      {item.trade && <span className="text-xs">({item.trade})</span>}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="border border-border rounded-sm p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Bid Details</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-muted mb-1">Required Trade *</label>
            <select className={inputClass} value={requiredTrade} onChange={(e) => { setRequiredTrade(e.target.value); setSelectedSubIds([]); }} required>
              <option value="">Select trade…</option>
              {TRADES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1">Response Deadline *</label>
            <input className={inputClass} type="date" value={responseDeadline} onChange={(e) => setResponseDeadline(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1">Start Window</label>
            <input className={inputClass} value={startWindow} onChange={(e) => setStartWindow(e.target.value)} placeholder="e.g., Mid-April 2026" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm text-text-muted mb-1">Special Requirements</label>
            <textarea className={inputClass} rows={2} value={specialRequirements} onChange={(e) => setSpecialRequirements(e.target.value)} placeholder="Permits, insurance minimums, site access…" />
          </div>
        </div>
      </section>

      {requiredTrade && (
        <section className="border border-border rounded-sm p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">
            Invite Subcontractors
            <span className="text-text-muted text-sm font-normal ml-2">({matchingSubs.length} matching)</span>
          </h2>
          {matchingSubs.length === 0 ? (
            <p className="text-text-muted text-sm">No approved subcontractors with this trade.</p>
          ) : (
            <div className="space-y-2">
              {matchingSubs.map((sub) => (
                <label key={sub.companyId} className="flex items-center justify-between text-sm cursor-pointer border-b border-border pb-2 last:border-b-0">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedSubIds.includes(sub.companyId)}
                      onChange={() => toggleSub(sub.companyId)}
                      className="rounded border-border"
                    />
                    <span className="text-text-primary font-medium">{sub.companyName}</span>
                  </div>
                  {sub.bidLimit && (
                    <span className="text-text-muted text-xs">Limit: ${sub.bidLimit.toLocaleString()}</span>
                  )}
                </label>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || selectedItemIds.length === 0}
          className="bg-brand text-white px-6 py-2 rounded-sm text-sm hover:bg-brand/90 transition-colors disabled:opacity-50"
        >
          {saving ? "Creating…" : "Create Bid Request"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="border border-border px-6 py-2 rounded-sm text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
