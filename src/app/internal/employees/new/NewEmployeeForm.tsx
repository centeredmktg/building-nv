"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewEmployeeForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    legalName: "", hireDate: "", employmentType: "W2", tradeClassification: "laborer",
    homeAddress: "", city: "", state: "NV", zip: "",
    ec1Name: "", ec1Relationship: "", ec1Phone: "",
    ec2Name: "", ec2Relationship: "", ec2Phone: "",
    driversLicenseNumber: "", driversLicenseExpiry: "",
  });

  const inputClass =
    "w-full bg-surface border border-border rounded-sm px-4 py-3 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent transition-colors";

  const set = (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const emp = await res.json();
      router.push(`/internal/employees/${emp.id}`);
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to save");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-2xl">
      <section>
        <h2 className="text-text-primary font-semibold mb-4">Contact Information</h2>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="First Name *" required value={form.firstName} onChange={set("firstName")} className={inputClass} />
            <input placeholder="Last Name" value={form.lastName} onChange={set("lastName")} className={inputClass} />
          </div>
          <input placeholder="Legal Name (as on ID) *" required value={form.legalName} onChange={set("legalName")} className={inputClass} />
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Email *" required type="email" value={form.email} onChange={set("email")} className={inputClass} />
            <input placeholder="Phone" value={form.phone} onChange={set("phone")} className={inputClass} />
          </div>
          <input placeholder="Home Address *" required value={form.homeAddress} onChange={set("homeAddress")} className={inputClass} />
          <div className="grid grid-cols-3 gap-3">
            <input placeholder="City *" required value={form.city} onChange={set("city")} className={inputClass} />
            <input placeholder="State *" required value={form.state} onChange={set("state")} className={inputClass} />
            <input placeholder="ZIP *" required value={form.zip} onChange={set("zip")} className={inputClass} />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-text-primary font-semibold mb-4">Employment Details</h2>
        <div className="flex flex-col gap-3">
          <input placeholder="Hire Date *" required type="date" value={form.hireDate} onChange={set("hireDate")} className={inputClass} />
          <div className="grid grid-cols-2 gap-3">
            <select required value={form.employmentType} onChange={set("employmentType")} className={`${inputClass} appearance-none`}>
              <option value="W2">W-2 Employee</option>
              <option value="CONTRACTOR_1099">1099 Contractor</option>
            </select>
            <select required value={form.tradeClassification} onChange={set("tradeClassification")} className={`${inputClass} appearance-none`}>
              <option value="laborer">Laborer</option>
              <option value="carpenter">Carpenter</option>
              <option value="electrician">Electrician</option>
              <option value="superintendent">Superintendent</option>
              <option value="pm">Project Manager</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Driver's License # (optional)" value={form.driversLicenseNumber} onChange={set("driversLicenseNumber")} className={inputClass} />
            <input placeholder="License Expiry (optional)" type="date" value={form.driversLicenseExpiry} onChange={set("driversLicenseExpiry")} className={inputClass} />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-text-primary font-semibold mb-4">Emergency Contact 1 <span className="text-red-400">*</span></h2>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Name *" required value={form.ec1Name} onChange={set("ec1Name")} className={inputClass} />
            <input placeholder="Relationship *" required value={form.ec1Relationship} onChange={set("ec1Relationship")} className={inputClass} />
          </div>
          <input placeholder="Phone *" required value={form.ec1Phone} onChange={set("ec1Phone")} className={inputClass} />
        </div>
      </section>

      <section>
        <h2 className="text-text-primary font-semibold mb-4">Emergency Contact 2 <span className="text-text-muted text-sm font-normal">(optional)</span></h2>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Name" value={form.ec2Name} onChange={set("ec2Name")} className={inputClass} />
            <input placeholder="Relationship" value={form.ec2Relationship} onChange={set("ec2Relationship")} className={inputClass} />
          </div>
          <input placeholder="Phone" value={form.ec2Phone} onChange={set("ec2Phone")} className={inputClass} />
        </div>
      </section>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-accent text-bg font-semibold px-6 py-3 rounded-sm text-sm hover:bg-accent/90 transition-colors disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Employee"}
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
  );
}
