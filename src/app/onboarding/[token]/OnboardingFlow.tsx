"use client";

import { useState } from "react";

interface OnboardingFlowProps {
  token: string;
  employeeId: string | null;
  completedSteps: string[];
  employmentType: string | null;
}

const STEPS = [
  "personal_info",
  "emergency_contacts",
  "employment_docs",
  "gusto_setup",
  "osha_certification",
  "safety_manual_ack",
  "workbook_ack",
  "complete",
] as const;

type StepName = typeof STEPS[number];

export default function OnboardingFlow({
  token,
  employeeId: initialEmployeeId,
  completedSteps,
  employmentType: initialEmploymentType,
}: OnboardingFlowProps) {
  const firstIncomplete = STEPS.find((s) => !completedSteps.includes(s)) ?? "complete";
  const [currentStep, setCurrentStep] = useState<StepName>(firstIncomplete);
  const [employeeId, setEmployeeId] = useState(initialEmployeeId);
  const [employmentType, setEmploymentType] = useState(initialEmploymentType ?? "W2");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const inputClass =
    "w-full border border-gray-300 rounded px-4 py-3 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-gray-600 transition-colors";

  const completeStep = async (stepName: StepName, stepData?: Record<string, unknown>, signerName?: string) => {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/onboarding/${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepName, stepData, signerName }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      return false;
    }
    if (stepName === "personal_info") {
      const data = await res.json();
      setEmployeeId(data.employeeId);
    }
    const nextIndex = STEPS.indexOf(stepName) + 1;
    if (nextIndex < STEPS.length) setCurrentStep(STEPS[nextIndex]);
    return true;
  };

  // When the flow reaches "complete", fire the final PATCH to flip invite status to "completed".
  // This must run as a side effect — not as part of a step transition — because the user
  // arrives here by completing "workbook_ack", not by clicking a "complete" button.
  const hasCompletedStep = completedSteps.includes("complete");
  if (currentStep === "complete" && !hasCompletedStep) {
    // Fire and forget — no need to await; the completion screen is shown immediately
    fetch(`/api/onboarding/${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepName: "complete" }),
    });
  }

  if (currentStep === "complete") {
    return (
      <div className="text-center py-12">
        <p className="text-2xl font-bold text-gray-900 mb-3">You&apos;re all set!</p>
        <p className="text-gray-500">Your onboarding is complete. Your supervisor will follow up with any next steps.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Progress */}
      <div className="flex gap-1 mb-8">
        {STEPS.slice(0, -1).map((step, i) => (
          <div
            key={step}
            className={`flex-1 h-1 rounded-full ${
              completedSteps.includes(step) || STEPS.indexOf(currentStep) > i
                ? "bg-gray-900"
                : "bg-gray-200"
            }`}
          />
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded px-4 py-3 mb-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Step: personal_info */}
      {currentStep === "personal_info" && (
        <PersonalInfoStep inputClass={inputClass} saving={saving} onComplete={(data) => {
          setEmploymentType(data.employmentType);
          completeStep("personal_info", data);
        }} />
      )}

      {/* Step: emergency_contacts */}
      {currentStep === "emergency_contacts" && (
        <EmergencyContactsStep inputClass={inputClass} saving={saving} onComplete={(data) => completeStep("emergency_contacts", data)} />
      )}

      {/* Step: employment_docs */}
      {currentStep === "employment_docs" && (
        <SimpleAckStep
          title="Employment Documents"
          description="Your I-9 (Employment Eligibility Verification) and W-4 (Federal Tax Withholding) forms must be completed with your supervisor in person."
          checkboxLabel="I understand I need to complete my I-9 and W-4 with my supervisor"
          saving={saving}
          onComplete={() => completeStep("employment_docs")}
        />
      )}

      {/* Step: gusto_setup */}
      {currentStep === "gusto_setup" && (
        <SimpleAckStep
          title="Payroll Setup"
          description="Check your email for an invitation from Gusto. Complete your account setup and add your direct deposit information before your first pay date."
          checkboxLabel="I have set up my Gusto account and direct deposit"
          saving={saving}
          onComplete={() => completeStep("gusto_setup")}
        />
      )}

      {/* Step: osha_certification (W2 only) */}
      {currentStep === "osha_certification" && (
        employmentType === "CONTRACTOR_1099" ? (
          // 1099 contractors skip OSHA requirement
          <div>
            <p className="text-gray-900 font-semibold text-lg mb-2">OSHA Certification</p>
            <p className="text-gray-500 text-sm mb-6">As a 1099 contractor, you are responsible for your own OSHA compliance. We require your site supervisor to hold a current OSHA 10 or OSHA 30 card.</p>
            <button
              onClick={() => completeStep("osha_certification")}
              disabled={saving}
              className="bg-gray-900 text-white font-semibold px-6 py-3 rounded text-sm hover:bg-gray-700 transition-colors disabled:opacity-60"
            >
              Continue
            </button>
          </div>
        ) : (
          <OshaCertStep token={token} employeeId={employeeId!} saving={saving} setSaving={setSaving} setError={setError} onComplete={() => completeStep("osha_certification")} />
        )
      )}

      {/* Step: safety_manual_ack */}
      {currentStep === "safety_manual_ack" && (
        <SignatureStep
          title="Safety Manual Acknowledgment"
          description="Please review the company Safety Manual. By signing below, you confirm you have received and understood its contents."
          documentLabel="View Safety Manual"
          documentHref="/docs/safety-manual"
          saving={saving}
          onComplete={(signerName) => completeStep("safety_manual_ack", undefined, signerName)}
        />
      )}

      {/* Step: workbook_ack */}
      {currentStep === "workbook_ack" && (
        <SignatureStep
          title="Onboarding Workbook Acknowledgment"
          description="By signing below, you confirm you have received and reviewed this Onboarding Workbook and agree to the policies described."
          saving={saving}
          onComplete={(signerName) => completeStep("workbook_ack", undefined, signerName)}
        />
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function PersonalInfoStep({
  inputClass,
  saving,
  onComplete,
}: {
  inputClass: string;
  saving: boolean;
  onComplete: (data: Record<string, string>) => void;
}) {
  const [form, setForm] = useState({
    firstName: "", lastName: "", legalName: "", phone: "",
    employmentType: "W2", tradeClassification: "laborer",
    homeAddress: "", city: "", state: "NV", zip: "",
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      <p className="text-gray-900 font-semibold text-lg mb-6">Personal Information</p>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="First Name *" required value={form.firstName} onChange={set("firstName")} className={inputClass} />
          <input placeholder="Last Name" value={form.lastName} onChange={set("lastName")} className={inputClass} />
        </div>
        <input placeholder="Legal Name (exactly as on ID) *" required value={form.legalName} onChange={set("legalName")} className={inputClass} />
        <input placeholder="Cell Phone" value={form.phone} onChange={set("phone")} className={inputClass} />
        <input placeholder="Home Address *" required value={form.homeAddress} onChange={set("homeAddress")} className={inputClass} />
        <div className="grid grid-cols-3 gap-3">
          <input placeholder="City *" required value={form.city} onChange={set("city")} className={inputClass} />
          <input placeholder="State *" required value={form.state} onChange={set("state")} className={inputClass} />
          <input placeholder="ZIP *" required value={form.zip} onChange={set("zip")} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <select value={form.employmentType} onChange={set("employmentType")} className={`${inputClass} appearance-none`}>
            <option value="W2">W-2 Employee</option>
            <option value="CONTRACTOR_1099">1099 Contractor</option>
          </select>
          <select value={form.tradeClassification} onChange={set("tradeClassification")} className={`${inputClass} appearance-none`}>
            <option value="laborer">Laborer</option>
            <option value="carpenter">Carpenter</option>
            <option value="electrician">Electrician</option>
            <option value="superintendent">Superintendent</option>
            <option value="pm">Project Manager</option>
            <option value="other">Other</option>
          </select>
        </div>
        <button
          onClick={() => {
            if (!form.firstName || !form.legalName || !form.homeAddress || !form.city || !form.zip) return;
            onComplete(form);
          }}
          disabled={saving}
          className="bg-gray-900 text-white font-semibold px-6 py-3 rounded text-sm hover:bg-gray-700 transition-colors disabled:opacity-60"
        >
          {saving ? "Saving..." : "Continue"}
        </button>
      </div>
    </div>
  );
}

function EmergencyContactsStep({
  inputClass,
  saving,
  onComplete,
}: {
  inputClass: string;
  saving: boolean;
  onComplete: (data: Record<string, string>) => void;
}) {
  const [form, setForm] = useState({
    ec1Name: "", ec1Relationship: "", ec1Phone: "",
    ec2Name: "", ec2Relationship: "", ec2Phone: "",
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      <p className="text-gray-900 font-semibold text-lg mb-2">Emergency Contacts</p>
      <p className="text-gray-500 text-sm mb-6">Who should we contact if something happens on the job site?</p>
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-gray-700 font-medium text-sm mb-2">Primary Contact <span className="text-red-500">*</span></p>
          <div className="flex flex-col gap-2">
            <input placeholder="Full Name *" required value={form.ec1Name} onChange={set("ec1Name")} className={inputClass} />
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Relationship (e.g. Spouse) *" required value={form.ec1Relationship} onChange={set("ec1Relationship")} className={inputClass} />
              <input placeholder="Phone *" required value={form.ec1Phone} onChange={set("ec1Phone")} className={inputClass} />
            </div>
          </div>
        </div>
        <div>
          <p className="text-gray-700 font-medium text-sm mb-2">Secondary Contact <span className="text-gray-400">(optional)</span></p>
          <div className="flex flex-col gap-2">
            <input placeholder="Full Name" value={form.ec2Name} onChange={set("ec2Name")} className={inputClass} />
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Relationship" value={form.ec2Relationship} onChange={set("ec2Relationship")} className={inputClass} />
              <input placeholder="Phone" value={form.ec2Phone} onChange={set("ec2Phone")} className={inputClass} />
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            if (!form.ec1Name || !form.ec1Relationship || !form.ec1Phone) return;
            onComplete(form);
          }}
          disabled={saving}
          className="bg-gray-900 text-white font-semibold px-6 py-3 rounded text-sm hover:bg-gray-700 transition-colors disabled:opacity-60"
        >
          {saving ? "Saving..." : "Continue"}
        </button>
      </div>
    </div>
  );
}

function SimpleAckStep({
  title, description, checkboxLabel, saving, onComplete,
}: {
  title: string;
  description: string;
  checkboxLabel: string;
  saving: boolean;
  onComplete: () => void;
}) {
  const [checked, setChecked] = useState(false);
  return (
    <div>
      <p className="text-gray-900 font-semibold text-lg mb-2">{title}</p>
      <p className="text-gray-500 text-sm mb-6">{description}</p>
      <label className="flex items-start gap-3 mb-6 cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5" />
        <span className="text-gray-700 text-sm">{checkboxLabel}</span>
      </label>
      <button
        onClick={onComplete}
        disabled={!checked || saving}
        className="bg-gray-900 text-white font-semibold px-6 py-3 rounded text-sm hover:bg-gray-700 transition-colors disabled:opacity-60"
      >
        {saving ? "Saving..." : "Continue"}
      </button>
    </div>
  );
}

function OshaCertStep({
  token, employeeId, saving, setSaving, setError, onComplete,
}: {
  token: string;
  employeeId: string;
  saving: boolean;
  setSaving: (v: boolean) => void;
  setError: (v: string) => void;
  onComplete: () => void;
}) {
  const [certType, setCertType] = useState("OSHA_10");
  const [issueDate, setIssueDate] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [skipCert, setSkipCert] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", "certifications");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    setUploading(false);
    if (res.ok) {
      const data = await res.json();
      setPhotoUrl(data.url);
    } else {
      setError("Upload failed — try again");
    }
  };

  const saveCert = async () => {
    if (!photoUrl || !issueDate) {
      setError("Please upload your card photo and enter the issue date.");
      return;
    }
    setSaving(true);
    await fetch(`/api/employees/${employeeId}/certifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: certType, issueDate, cardPhotoUrl: photoUrl }),
    });
    setSaving(false);
    onComplete();
  };

  // token is used for API context but not directly in this component's fetch calls
  void token;

  return (
    <div>
      <p className="text-gray-900 font-semibold text-lg mb-2">OSHA Certification</p>
      <p className="text-gray-500 text-sm mb-6">
        W-2 field workers are required to hold a current OSHA 10 certification.
        Upload a photo of your card. No card = unverified status.
      </p>

      {!skipCert ? (
        <div className="flex flex-col gap-4">
          <select
            value={certType}
            onChange={(e) => setCertType(e.target.value)}
            className="border border-gray-300 rounded px-4 py-3 text-gray-900 text-sm appearance-none"
          >
            <option value="OSHA_10">OSHA 10-Hour</option>
            <option value="OSHA_30">OSHA 30-Hour</option>
          </select>
          <input
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            className="border border-gray-300 rounded px-4 py-3 text-gray-900 text-sm"
            placeholder="Issue Date"
          />
          <div>
            <label className="text-gray-600 text-sm block mb-1">Card Photo *</label>
            <input type="file" accept="image/*" onChange={handleUpload} className="text-sm text-gray-600" />
            {uploading && <p className="text-gray-500 text-xs mt-1">Uploading...</p>}
            {photoUrl && <p className="text-green-600 text-xs mt-1">✓ Card uploaded</p>}
          </div>
          <button
            onClick={saveCert}
            disabled={saving || uploading}
            className="bg-gray-900 text-white font-semibold px-6 py-3 rounded text-sm hover:bg-gray-700 transition-colors disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Certification & Continue"}
          </button>
          <button
            onClick={() => setSkipCert(true)}
            className="text-gray-400 text-sm hover:text-gray-600"
          >
            I don&apos;t have my card yet →
          </button>
        </div>
      ) : (
        <div>
          <div className="bg-yellow-50 border border-yellow-200 rounded px-4 py-3 mb-6">
            <p className="text-yellow-800 text-sm font-medium">You will be flagged as unverified</p>
            <p className="text-yellow-700 text-sm mt-1">
              W-2 workers must obtain OSHA 10 within 30 days of hire. Upload your card on your employee profile once you have it.
            </p>
          </div>
          <button
            onClick={onComplete}
            disabled={saving}
            className="bg-gray-900 text-white font-semibold px-6 py-3 rounded text-sm hover:bg-gray-700 transition-colors disabled:opacity-60"
          >
            Continue Without Certification
          </button>
        </div>
      )}
    </div>
  );
}

function SignatureStep({
  title, description, documentLabel, documentHref, saving, onComplete,
}: {
  title: string;
  description: string;
  documentLabel?: string;
  documentHref?: string;
  saving: boolean;
  onComplete: (signerName: string) => void;
}) {
  const [signerName, setSignerName] = useState("");
  return (
    <div>
      <p className="text-gray-900 font-semibold text-lg mb-2">{title}</p>
      <p className="text-gray-500 text-sm mb-4">{description}</p>
      {documentLabel && documentHref && (
        <a
          href={documentHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 text-sm underline mb-6 inline-block"
        >
          {documentLabel} →
        </a>
      )}
      <div className="border border-gray-200 rounded p-4 mb-4">
        <label className="text-gray-600 text-xs uppercase tracking-wide block mb-2">
          Type your full legal name to sign
        </label>
        <input
          type="text"
          placeholder="Full legal name"
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 text-sm focus:outline-none focus:border-gray-600"
        />
      </div>
      <button
        onClick={() => { if (signerName.trim()) onComplete(signerName.trim()); }}
        disabled={!signerName.trim() || saving}
        className="bg-gray-900 text-white font-semibold px-6 py-3 rounded text-sm hover:bg-gray-700 transition-colors disabled:opacity-60"
      >
        {saving ? "Signing..." : "Sign & Continue"}
      </button>
    </div>
  );
}
