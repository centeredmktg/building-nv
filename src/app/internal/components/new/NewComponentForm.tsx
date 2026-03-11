"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Vendor { id: string; name: string }

export default function NewComponentForm({ vendors }: { vendors: Vendor[] }) {
  const [form, setForm] = useState({
    name: "", description: "", category: "", vendorSku: "",
    vendorCost: "", unit: "ea", vendorId: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const inputClass =
    "w-full bg-surface border border-border rounded-sm px-4 py-3 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent transition-colors";

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/components", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, vendorCost: parseFloat(form.vendorCost) }),
    });
    if (res.ok) {
      router.push("/internal/components");
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to save");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <input placeholder="Component Name *" required value={form.name} onChange={set("name")} className={inputClass} />
      <div className="grid grid-cols-2 gap-4">
        <input placeholder="Category (e.g. Flooring)" value={form.category} onChange={set("category")} className={inputClass} />
        <input placeholder="Unit (e.g. sf, ea, lf)" value={form.unit} onChange={set("unit")} className={inputClass} />
      </div>
      <select required value={form.vendorId} onChange={set("vendorId")} className={`${inputClass} appearance-none`}>
        <option value="" disabled>Select Vendor *</option>
        {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-4">
        <input placeholder="Vendor SKU (optional)" value={form.vendorSku} onChange={set("vendorSku")} className={inputClass} />
        <input placeholder="Vendor Cost * (e.g. 4.50)" required type="number" step="0.01" min="0" value={form.vendorCost} onChange={set("vendorCost")} className={inputClass} />
      </div>
      <textarea placeholder="Description (optional)" rows={3} value={form.description} onChange={set("description")} className={`${inputClass} resize-none`} />
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="bg-accent text-bg font-semibold px-6 py-3 rounded-sm text-sm hover:bg-accent/90 transition-colors disabled:opacity-60">
          {saving ? "Saving..." : "Save Component"}
        </button>
        <button type="button" onClick={() => router.back()} className="text-text-muted text-sm hover:text-text-primary transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}
