"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TRADES, ONBOARDING_STATUSES } from "@/lib/trades";

export default function NewSubcontractorForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [domain, setDomain] = useState("");
  const [trades, setTrades] = useState<string[]>([]);
  const [licenseNumber, setLicenseNumber] = useState("");
  const [bidLimit, setBidLimit] = useState("");
  const [notes, setNotes] = useState("");

  const inputClass = "w-full border border-border rounded-sm px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand";

  const toggleTrade = (tradeId: string) => {
    setTrades((prev) =>
      prev.includes(tradeId) ? prev.filter((t) => t !== tradeId) : [...prev, tradeId],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/subcontractors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, phone, domain, trades, licenseNumber, bidLimit, notes }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create subcontractor");
      }

      const data = await res.json();
      router.push(`/internal/subcontractors/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-text-primary mb-6">Add Subcontractor</h1>

      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-sm mb-4 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="border border-border rounded-sm p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Company Info</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm text-text-muted mb-1">Company Name *</label>
              <input className={inputClass} value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Phone</label>
              <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Website</label>
              <input className={inputClass} value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" />
            </div>
          </div>
        </section>

        <section className="border border-border rounded-sm p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">License & Capacity</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-muted mb-1">NV License Number</label>
              <input className={inputClass} value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Bid Limit ($)</label>
              <input className={inputClass} type="number" value={bidLimit} onChange={(e) => setBidLimit(e.target.value)} />
            </div>
          </div>
        </section>

        <section className="border border-border rounded-sm p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Trades *</h2>
          <div className="grid grid-cols-3 gap-2">
            {TRADES.map((trade) => (
              <label key={trade.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={trades.includes(trade.id)}
                  onChange={() => toggleTrade(trade.id)}
                  className="rounded border-border"
                />
                {trade.label}
              </label>
            ))}
          </div>
        </section>

        <section className="border border-border rounded-sm p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Notes</h2>
          <textarea className={inputClass} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </section>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-brand text-white px-6 py-2 rounded-sm text-sm hover:bg-brand/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Create Subcontractor"}
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
    </div>
  );
}
