"use client";

import { useState } from "react";

interface SiteFormProps {
  projectId: string;
  initial: {
    siteAddress: string | null;
    siteCity: string | null;
    siteState: string | null;
    siteZip: string | null;
    hazardNotes: string | null;
  };
}

export default function ProjectSiteForm({ projectId, initial }: SiteFormProps) {
  const [form, setForm] = useState({
    siteAddress: initial.siteAddress ?? "",
    siteCity: initial.siteCity ?? "",
    siteState: initial.siteState ?? "NV",
    siteZip: initial.siteZip ?? "",
    hazardNotes: initial.hazardNotes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const inputClass =
    "w-full bg-surface border border-border rounded-sm px-3 py-2 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent transition-colors";

  const set = (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3">
      <input placeholder="Site Address" value={form.siteAddress} onChange={set("siteAddress")} className={inputClass} />
      <div className="grid grid-cols-3 gap-2">
        <input placeholder="City" value={form.siteCity} onChange={set("siteCity")} className={inputClass} />
        <input placeholder="State" value={form.siteState} onChange={set("siteState")} className={inputClass} />
        <input placeholder="ZIP" value={form.siteZip} onChange={set("siteZip")} className={inputClass} />
      </div>
      <textarea
        placeholder="Site-specific hazards (e.g. asbestos suspected, unstable soil, high voltage nearby)"
        rows={3}
        value={form.hazardNotes}
        onChange={set("hazardNotes")}
        className={`${inputClass} resize-none`}
      />
      <button
        onClick={save}
        disabled={saving}
        className="self-start bg-accent text-bg font-semibold px-4 py-2 rounded-sm text-sm hover:bg-accent/90 transition-colors disabled:opacity-60"
      >
        {saving ? "Saving..." : saved ? "Saved ✓" : "Save Site Info"}
      </button>
    </div>
  );
}
