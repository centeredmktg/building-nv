"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PROJECT_TYPES = [
  "Office Buildout",
  "Retail / Restaurant",
  "Medical Suite",
  "Warehouse / Industrial",
  "Suite Renovation",
  "Light Maintenance / Repair",
  "Other",
];

interface GeneratedItem {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  isMaterial: boolean;
}

interface GeneratedSection {
  title: string;
  items: GeneratedItem[];
}

export default function NewQuotePage() {
  const router = useRouter();
  const [step, setStep] = useState<"intake" | "questions" | "review">("intake");
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [sections, setSections] = useState<GeneratedSection[]>([]);

  const [form, setForm] = useState({
    clientName: "",
    clientCompany: "",
    address: "",
    projectType: "",
    scopeText: "",
  });

  const inputClass =
    "w-full bg-surface border border-border rounded-sm px-4 py-3 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent transition-colors";

  const handleGenerate = async () => {
    setLoading(true);
    const scopeWithAnswers =
      answers.length > 0
        ? `${form.scopeText}\n\nAdditional information:\n${questions.map((q, i) => `Q: ${q}\nA: ${answers[i] || "Not provided"}`).join("\n")}`
        : form.scopeText;

    const res = await fetch("/api/quotes/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scopeText: scopeWithAnswers }),
    });
    const data = await res.json();

    if (data.questions && data.questions.length > 0) {
      setQuestions(data.questions);
      setAnswers(new Array(data.questions.length).fill(""));
      setStep("questions");
    } else {
      setSections(data.sections);
      setStep("review");
    }
    setLoading(false);
  };

  const handleCreateQuote = async () => {
    setLoading(true);
    const quoteRes = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form }),
    });
    const quote = await quoteRes.json();

    await fetch(`/api/quotes/${quote.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        materialMarkupPct: 10,
        overheadPct: 10,
        profitPct: 10,
        sections,
      }),
    });

    router.push(`/internal/quotes/${quote.id}/edit`);
  };

  if (step === "questions") {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-text-primary mb-2">Clarifying Questions</h1>
        <p className="text-text-muted text-sm mb-8">
          Claude needs a few more details to price this accurately.
        </p>
        <div className="flex flex-col gap-6">
          {questions.map((q, i) => (
            <div key={i}>
              <label className="text-text-primary text-sm font-medium block mb-2">{q}</label>
              <input
                type="text"
                value={answers[i]}
                onChange={(e) => {
                  const next = [...answers];
                  next[i] = e.target.value;
                  setAnswers(next);
                }}
                className={inputClass}
                placeholder="Your answer..."
              />
            </div>
          ))}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-accent text-bg font-semibold py-3 rounded-sm text-sm hover:bg-accent/90 transition-colors disabled:opacity-60"
          >
            {loading ? "Generating..." : "Generate Quote"}
          </button>
        </div>
      </div>
    );
  }

  if (step === "review") {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-text-primary mb-2">Review Generated Quote</h1>
        <p className="text-text-muted text-sm mb-8">All fields are editable after saving.</p>
        <div className="flex flex-col gap-6 mb-8">
          {sections.map((sec, si) => (
            <div key={si} className="border border-border rounded-sm">
              <div className="px-4 py-3 border-b border-border bg-surface">
                <span className="text-text-primary font-medium text-sm">{sec.title}</span>
              </div>
              <div className="divide-y divide-border">
                {sec.items.map((item, ii) => (
                  <div key={ii} className="px-4 py-3 grid grid-cols-12 gap-3 items-center text-sm">
                    <span className="col-span-6 text-text-primary">{item.description}</span>
                    <span className="col-span-2 text-text-muted text-right">{item.quantity} {item.unit}</span>
                    <span className="col-span-2 text-text-muted text-right">${item.unitPrice}</span>
                    <span className="col-span-2 text-text-primary text-right font-medium">
                      ${(item.quantity * item.unitPrice).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setStep("intake")}
            className="border border-border text-text-primary px-5 py-2.5 rounded-sm text-sm hover:border-text-muted transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleCreateQuote}
            disabled={loading}
            className="bg-accent text-bg font-semibold px-5 py-2.5 rounded-sm text-sm hover:bg-accent/90 transition-colors disabled:opacity-60"
          >
            {loading ? "Creating..." : "Save & Edit Quote"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-text-primary mb-8">New Quote</h1>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <input name="clientName" type="text" placeholder="Client Name *" required
            value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })}
            className={inputClass} />
          <input name="clientCompany" type="text" placeholder="Company / Property"
            value={form.clientCompany} onChange={(e) => setForm({ ...form, clientCompany: e.target.value })}
            className={inputClass} />
        </div>
        <input name="address" type="text" placeholder="Job Site Address *" required
          value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
          className={inputClass} />
        <select name="projectType" value={form.projectType}
          onChange={(e) => setForm({ ...form, projectType: e.target.value })}
          className={`${inputClass} appearance-none`}>
          <option value="" disabled>Project Type *</option>
          {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <textarea name="scopeText" placeholder="Paste the scope of work here..." rows={10}
          value={form.scopeText} onChange={(e) => setForm({ ...form, scopeText: e.target.value })}
          className={`${inputClass} resize-none`} />
        <button onClick={handleGenerate}
          disabled={loading || !form.clientName || !form.address || !form.scopeText}
          className="bg-accent text-bg font-semibold py-3 rounded-sm text-sm hover:bg-accent/90 transition-colors disabled:opacity-60">
          {loading ? "Analyzing scope..." : "Generate Quote with AI"}
        </button>
      </div>
    </div>
  );
}
