"use client";

import { useState, useRef } from "react";

interface ApplyFormProps {
  jobPostingId: string;
  jobTitle: string;
}

export default function ApplyForm({ jobPostingId, jobTitle }: ApplyFormProps) {
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const inputClass =
    "w-full bg-bg border border-border rounded-sm px-4 py-3 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent transition-colors";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please attach your resume.");
      return;
    }
    setSubmitting(true);
    setError("");

    const formData = new FormData();
    formData.append("name", form.name);
    formData.append("email", form.email);
    formData.append("phone", form.phone);
    formData.append("jobPostingId", jobPostingId);
    formData.append("resume", file);

    const res = await fetch("/api/careers/apply", { method: "POST", body: formData });

    if (res.ok) {
      setSubmitted(true);
    } else {
      const data = await res.json();
      setError(data.error ?? "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="border border-green-500/20 bg-green-500/5 rounded-sm p-6 text-center">
        <p className="text-green-400 font-medium">Thanks for applying! We&apos;ll be in touch.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-text-muted text-sm mb-2">
        Applying for: <span className="text-text-primary font-medium">{jobTitle}</span>
      </p>
      <input
        placeholder="Full Name *"
        required
        value={form.name}
        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
        className={inputClass}
      />
      <input
        placeholder="Email *"
        type="email"
        required
        value={form.email}
        onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
        className={inputClass}
      />
      <input
        placeholder="Phone (optional)"
        type="tel"
        value={form.phone}
        onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
        className={inputClass}
      />
      <div>
        <label className="block text-text-muted text-sm mb-2">Resume (PDF or Word, max 10MB) *</label>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-text-muted text-sm file:mr-4 file:py-2 file:px-4 file:rounded-sm file:border file:border-border file:text-sm file:font-medium file:bg-surface file:text-text-primary hover:file:bg-surface-2 file:cursor-pointer file:transition-colors"
        />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="bg-accent text-bg font-semibold px-6 py-3 rounded-sm text-sm hover:bg-accent/90 transition-colors disabled:opacity-60 self-start"
      >
        {submitting ? "Submitting..." : "Submit Application"}
      </button>
    </form>
  );
}
