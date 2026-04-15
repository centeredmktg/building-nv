"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const JOB_TYPES = ["full-time", "part-time", "contract"];

export default function NewJobPostingPage() {
  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "Reno, NV",
    type: "part-time",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const inputClass =
    "w-full bg-surface border border-border rounded-sm px-4 py-3 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent transition-colors";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = await fetch("/api/job-postings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      router.push("/internal/careers");
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to save");
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-text-primary mb-8">New Job Posting</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          placeholder="Job Title *"
          required
          value={form.title}
          onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          className={inputClass}
        />
        <textarea
          placeholder="Job Description *"
          required
          rows={6}
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          className={`${inputClass} resize-none`}
        />
        <input
          placeholder="Location *"
          required
          value={form.location}
          onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
          className={inputClass}
        />
        <select
          value={form.type}
          onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
          className={inputClass}
        >
          {JOB_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-accent text-bg font-semibold px-6 py-3 rounded-sm text-sm hover:bg-accent/90 transition-colors disabled:opacity-60"
          >
            {saving ? "Saving..." : "Create Posting"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="text-text-muted text-sm hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
