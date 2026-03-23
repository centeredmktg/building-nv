// src/app/internal/quotes/new/page.tsx
"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface LineItem {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  isMaterial: boolean;
}

interface Section {
  title: string;
  items: LineItem[];
}

interface Extracted {
  contactName?: string;
  address?: string;
  projectType?: string;
  gaps: string[];
}

interface ContactResult {
  id: string;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface CompanyResult {
  id: string;
  name: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const GAP_LABELS: Record<string, string> = {
  contact_name: "Who's the contact on this job?",
  address: "Confirm the job site address:",
  project_type: "What type of project is this?",
};

const PROJECT_TYPES = [
  "Office Buildout",
  "Retail / Restaurant",
  "Medical Suite",
  "Warehouse / Industrial",
  "Suite Renovation",
  "Light Maintenance / Repair",
  "Other",
];

const inputClass =
  "w-full bg-surface border border-border rounded-sm px-4 py-3 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent transition-colors";

// ─── ContactSearch sub-component ───────────────────────────────────────────────

function ContactSearch({
  onSelect,
}: {
  onSelect: (contact: ContactResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ContactResult[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [creating, setCreating] = useState(false);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    const res = await fetch(`/api/contacts?q=${encodeURIComponent(q)}`);
    setResults(await res.json());
  }, []);

  const handleCreate = async () => {
    if (!newFirst.trim()) return;
    setCreating(true);
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: newFirst, lastName: newLast, phone: newPhone }),
    });
    const contact = await res.json();
    onSelect(contact);
    setCreating(false);
    setShowCreate(false);
  };

  if (showCreate) {
    return (
      <div className="border border-border rounded-sm p-4 flex flex-col gap-3">
        <p className="text-text-muted text-xs uppercase tracking-widest">New Contact</p>
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="First name *" value={newFirst} onChange={(e) => setNewFirst(e.target.value)} className={inputClass} />
          <input placeholder="Last name" value={newLast} onChange={(e) => setNewLast(e.target.value)} className={inputClass} />
        </div>
        <input placeholder="Phone" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} className={inputClass} />
        <div className="flex gap-2">
          <button onClick={handleCreate} disabled={!newFirst.trim() || creating}
            className="bg-accent text-bg px-4 py-2 rounded-sm text-sm font-semibold hover:bg-accent/90 disabled:opacity-50 transition-colors">
            {creating ? "Creating…" : "Add Contact"}
          </button>
          <button onClick={() => setShowCreate(false)}
            className="border border-border text-text-muted px-4 py-2 rounded-sm text-sm hover:border-text-muted transition-colors">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); search(e.target.value); }}
        placeholder="Search contacts…"
        className={inputClass}
      />
      {results.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-surface border border-border rounded-sm shadow-lg z-10 mt-1">
          {results.map((c) => (
            <button key={c.id} onClick={() => { onSelect(c); setQuery(""); setResults([]); }}
              className="w-full text-left px-4 py-3 hover:bg-surface-2 transition-colors text-sm">
              <span className="text-text-primary font-medium">{c.firstName} {c.lastName}</span>
              {c.phone && <span className="text-text-muted ml-2">{c.phone}</span>}
            </button>
          ))}
        </div>
      )}
      {query.length > 1 && results.length === 0 && (
        <button onClick={() => { setShowCreate(true); setNewFirst(query); setQuery(""); }}
          className="absolute top-full left-0 right-0 bg-surface border border-border rounded-sm mt-1 px-4 py-3 text-sm text-accent hover:bg-surface-2 transition-colors text-left z-10">
          + Create "{query}" as new contact
        </button>
      )}
    </div>
  );
}

// ─── CompanySearch sub-component ───────────────────────────────────────────────

function CompanySearch({ onSelect }: { onSelect: (company: CompanyResult) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CompanyResult[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    const res = await fetch(`/api/companies?q=${encodeURIComponent(q)}`);
    setResults(await res.json());
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    const company = await res.json();
    onSelect(company);
    setCreating(false);
    setShowCreate(false);
  };

  if (showCreate) {
    return (
      <div className="border border-border rounded-sm p-4 flex flex-col gap-3">
        <p className="text-text-muted text-xs uppercase tracking-widest">New Company</p>
        <input placeholder="Company name *" value={newName} onChange={(e) => setNewName(e.target.value)} className={inputClass} />
        <div className="flex gap-2">
          <button onClick={handleCreate} disabled={!newName.trim() || creating}
            className="bg-accent text-bg px-4 py-2 rounded-sm text-sm font-semibold hover:bg-accent/90 disabled:opacity-50 transition-colors">
            {creating ? "Creating…" : "Add Company"}
          </button>
          <button onClick={() => setShowCreate(false)}
            className="border border-border text-text-muted px-4 py-2 rounded-sm text-sm hover:border-text-muted transition-colors">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); search(e.target.value); }}
        placeholder="Search companies…"
        className={inputClass}
      />
      {results.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-surface border border-border rounded-sm shadow-lg z-10 mt-1">
          {results.map((c) => (
            <button key={c.id} onClick={() => { onSelect(c); setQuery(""); setResults([]); }}
              className="w-full text-left px-4 py-3 hover:bg-surface-2 transition-colors text-sm text-text-primary">
              {c.name}
            </button>
          ))}
        </div>
      )}
      {query.length > 1 && results.length === 0 && (
        <button onClick={() => { setShowCreate(true); setNewName(query); setQuery(""); }}
          className="absolute top-full left-0 right-0 bg-surface border border-border rounded-sm mt-1 px-4 py-3 text-sm text-accent hover:bg-surface-2 transition-colors text-left z-10">
          + Create "{query}" as new company
        </button>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

type Mode = "ai" | "manual";
type Phase = "idle" | "streaming" | "draft" | "saving";

export default function NewQuotePage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("ai");
  const [phase, setPhase] = useState<Phase>("idle");
  const [scopeText, setScopeText] = useState("");

  // CRM links
  const [selectedContact, setSelectedContact] = useState<ContactResult | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<CompanyResult | null>(null);
  const [companyRole, setCompanyRole] = useState("tenant");

  // Manual fields (also used to resolve gaps)
  const [address, setAddress] = useState("");
  const [projectType, setProjectType] = useState("");

  // Draft state
  const [sections, setSections] = useState<Section[]>([]);
  const [gaps, setGaps] = useState<string[]>([]);
  const [streamStatus, setStreamStatus] = useState("");

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const grandTotal = sections.reduce(
    (t, s) => t + s.items.reduce((st, i) => st + i.quantity * i.unitPrice, 0),
    0
  );

  // ── Generate (AI mode) ──────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!scopeText.trim()) return;
    setPhase("streaming");
    setStreamStatus("Analyzing scope…");
    setSections([]);
    setGaps([]);

    const res = await fetch("/api/quotes/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scopeText }),
    });

    if (!res.body) { setPhase("idle"); return; }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.type === "extracted") {
            if (event.address && !address) setAddress(event.address);
            if (event.projectType && !projectType) setProjectType(event.projectType);
            const baseGaps: string[] = event.gaps ?? [];
            if (!selectedContact && !baseGaps.includes("contact_name")) {
              setGaps([...baseGaps, "contact_name"]);
            } else {
              setGaps(baseGaps);
            }
            setStreamStatus("Generating line items…");
          } else if (event.type === "section") {
            setSections((prev) => [...prev, event.data]);
            setStreamStatus("");
          } else if (event.type === "done") {
            setPhase("draft");
          }
        } catch {
          // malformed line — skip
        }
      }
    }

    setPhase("draft");
  };

  // ── Save quote ──────────────────────────────────────────────────────────────

  const canSave =
    selectedContact !== null &&
    address.trim() !== "" &&
    projectType.trim() !== "" &&
    sections.length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setPhase("saving");

    const res = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address,
        projectType,
        contacts: selectedContact
          ? [{ contactId: selectedContact.id, role: "decision_maker" }]
          : [],
        companies: selectedCompany
          ? [{ companyId: selectedCompany.id, role: companyRole }]
          : [],
        sections,
      }),
    });

    if (!res.ok) { setPhase("draft"); return; }
    const quote = await res.json();
    router.push(`/internal/quotes/${quote.id}/edit`);
  };

  // ── Gap resolution ──────────────────────────────────────────────────────────

  const resolveGap = (key: string) =>
    setGaps((prev) => prev.filter((g) => g !== key));

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-text-primary">New Quote</h1>
        {phase === "idle" && (
          <div className="flex gap-1 border border-border rounded-sm p-0.5">
            {(["ai", "manual"] as Mode[]).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-4 py-1.5 rounded-sm text-sm font-medium transition-colors ${mode === m ? "bg-accent text-bg" : "text-text-muted hover:text-text-primary"}`}>
                {m === "ai" ? "AI Draft" : "Manual"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Contacts / Companies (always visible) ── */}
      <div className="flex flex-col gap-4 mb-6">
        <div>
          <p className="text-text-muted text-xs uppercase tracking-widest mb-2">Contact</p>
          {selectedContact ? (
            <div className="flex items-center justify-between border border-border rounded-sm px-4 py-3">
              <span className="text-text-primary text-sm font-medium">
                {selectedContact.firstName} {selectedContact.lastName}
                {selectedContact.phone && <span className="text-text-muted font-normal ml-2">{selectedContact.phone}</span>}
              </span>
              <button onClick={() => setSelectedContact(null)} className="text-text-muted hover:text-text-primary text-lg leading-none">×</button>
            </div>
          ) : (
            <ContactSearch onSelect={(c) => { setSelectedContact(c); resolveGap("contact_name"); }} />
          )}
        </div>

        <div>
          <p className="text-text-muted text-xs uppercase tracking-widest mb-2">Company <span className="normal-case text-text-muted font-normal">(optional)</span></p>
          {selectedCompany ? (
            <div className="flex items-center justify-between border border-border rounded-sm px-4 py-3">
              <span className="text-text-primary text-sm">{selectedCompany.name}</span>
              <div className="flex items-center gap-3">
                <select value={companyRole} onChange={(e) => setCompanyRole(e.target.value)}
                  className="bg-surface-2 border border-border rounded-sm px-2 py-1 text-text-muted text-xs focus:outline-none">
                  <option value="tenant">Tenant</option>
                  <option value="landlord">Landlord</option>
                  <option value="property_manager">Property Manager</option>
                  <option value="owner">Owner</option>
                </select>
                <button onClick={() => setSelectedCompany(null)} className="text-text-muted hover:text-text-primary text-lg leading-none">×</button>
              </div>
            </div>
          ) : (
            <CompanySearch onSelect={setSelectedCompany} />
          )}
        </div>
      </div>

      {/* ── Address + Project Type ── */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-text-muted text-xs uppercase tracking-widest mb-2">Job Site Address</p>
          <input value={address} onChange={(e) => { setAddress(e.target.value); if (e.target.value) resolveGap("address"); }}
            placeholder="123 Main St, Reno NV" className={inputClass} />
        </div>
        <div>
          <p className="text-text-muted text-xs uppercase tracking-widest mb-2">Project Type</p>
          <select value={projectType} onChange={(e) => { setProjectType(e.target.value); if (e.target.value) resolveGap("project_type"); }}
            className={`${inputClass} appearance-none`}>
            <option value="" disabled>Select type…</option>
            {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* ── AI scope input (AI mode, idle only) ── */}
      {mode === "ai" && phase === "idle" && (
        <div className="mb-6">
          <p className="text-text-muted text-xs uppercase tracking-widest mb-2">Scope / RFP / Transcript</p>
          <textarea
            value={scopeText}
            onChange={(e) => setScopeText(e.target.value)}
            rows={10}
            placeholder="Paste scope of work, RFP, or voice transcript…"
            className={`${inputClass} resize-none`}
          />
          <button onClick={handleGenerate} disabled={!scopeText.trim()}
            className="mt-3 w-full bg-accent text-bg font-semibold py-3 rounded-sm text-sm hover:bg-accent/90 disabled:opacity-50 transition-colors">
            Generate Quote Draft
          </button>
        </div>
      )}

      {/* ── Streaming status ── */}
      {phase === "streaming" && (
        <div className="mb-4 flex items-center gap-2 text-text-muted text-sm">
          <span className="inline-block w-3 h-3 rounded-full bg-accent animate-pulse" />
          {streamStatus || "Generating…"}
        </div>
      )}

      {/* ── Gap callouts ── */}
      {(phase === "streaming" || phase === "draft") && gaps.length > 0 && (
        <div className="flex flex-col gap-2 mb-6">
          {gaps.map((gap) => (
            <div key={gap} className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-sm px-4 py-3 text-sm">
              <span className="text-amber-400">⚠</span>
              <span className="text-text-primary flex-1">{GAP_LABELS[gap] ?? gap}</span>
              <button onClick={() => resolveGap(gap)} className="text-text-muted text-xs hover:text-text-primary">dismiss</button>
            </div>
          ))}
        </div>
      )}

      {/* ── Draft line items ── */}
      {sections.length > 0 && (
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
                    <span className="col-span-2 text-text-muted text-right">
                      {item.quantity === 1 && item.unit.toLowerCase() === "ls"
                        ? "Flat Rate"
                        : `${item.quantity.toLocaleString("en-US")} ${item.unit}`}
                    </span>
                    <span className="col-span-2 text-text-muted text-right">${fmt(item.unitPrice)}</span>
                    <span className="col-span-2 text-text-primary text-right font-medium">
                      ${fmt(item.quantity * item.unitPrice)}
                    </span>
                  </div>
                ))}
                <div className="px-4 py-3 grid grid-cols-12 gap-3 text-sm bg-surface">
                  <span className="col-span-10 text-text-muted text-right text-xs font-medium uppercase tracking-wider">Subtotal</span>
                  <span className="col-span-2 text-text-primary text-right font-semibold">
                    ${fmt(sec.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0))}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {/* Grand total */}
          <div className="border border-border rounded-sm px-4 py-4 grid grid-cols-12 gap-3 items-center">
            <span className="col-span-10 text-text-muted text-right text-sm font-semibold uppercase tracking-wider">Grand Total</span>
            <span className="col-span-2 text-text-primary text-right text-xl font-bold">${fmt(grandTotal)}</span>
          </div>

          {/* Save button */}
          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={!canSave || phase === "saving"}
              className="bg-accent text-bg font-semibold px-6 py-3 rounded-sm text-sm hover:bg-accent/90 disabled:opacity-50 transition-colors">
              {phase === "saving" ? "Saving…" : "Save & Edit Quote"}
            </button>
            {!canSave && (
              <p className="text-text-muted text-sm">
                {!selectedContact
                  ? "Search or create a contact to save"
                  : !address
                  ? "Add a job site address to save"
                  : !projectType
                  ? "Select a project type to save"
                  : "Add at least one line item to save"}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Manual mode: empty editor placeholder ── */}
      {mode === "manual" && phase === "idle" && (
        <div className="border border-dashed border-border rounded-sm p-8 text-center">
          <p className="text-text-muted text-sm mb-4">Fill in contact, address, and project type above, then save to open the quote editor.</p>
          <button
            onClick={async () => {
              if (!address.trim() || !projectType.trim()) return;
              setPhase("saving");
              const res = await fetch("/api/quotes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  address,
                  projectType,
                  contacts: selectedContact ? [{ contactId: selectedContact.id, role: "decision_maker" }] : [],
                  companies: selectedCompany ? [{ companyId: selectedCompany.id, role: companyRole }] : [],
                  sections: [],
                }),
              });
              if (res.ok) {
                const quote = await res.json();
                router.push(`/internal/quotes/${quote.id}/edit`);
              } else {
                setPhase("idle");
              }
            }}
            disabled={!address.trim() || !projectType.trim()}
            className="bg-accent text-bg font-semibold px-6 py-3 rounded-sm text-sm hover:bg-accent/90 disabled:opacity-50 transition-colors">
            Create Blank Quote
          </button>
        </div>
      )}
    </div>
  );
}
