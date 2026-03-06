"use client";

import { useState } from "react";

export default function AcceptanceBlock({ slug, accepted, signerName, acceptedAt }: {
  slug: string;
  accepted: boolean;
  signerName?: string;
  acceptedAt?: string;
}) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done">(accepted ? "done" : "idle");
  const [finalName, setFinalName] = useState(signerName || "");
  const [finalDate, setFinalDate] = useState(acceptedAt || "");

  const handleAccept = async () => {
    if (!name.trim()) return;
    setStatus("loading");
    const res = await fetch(`/api/proposals/${slug}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signerName: name }),
    });
    const data = await res.json();
    setFinalName(name);
    setFinalDate(new Date(data.acceptedAt).toLocaleString());
    setStatus("done");
  };

  if (status === "done") {
    return (
      <div className="border border-green-800 bg-green-950/30 rounded-sm p-6 print:border-border print:bg-transparent">
        <p className="text-green-400 font-semibold mb-1">Proposal Accepted</p>
        <p className="text-gray-600 text-sm">
          Accepted by <span className="text-gray-900">{finalName}</span>
          {finalDate && <> on {finalDate}</>}
        </p>
      </div>
    );
  }

  return (
    <div className="border border-gray-300 rounded-sm p-6 print:hidden">
      <h3 className="text-gray-900 font-semibold mb-1">Acceptance of Proposal</h3>
      <p className="text-gray-600 text-sm mb-4">
        By entering your name and clicking Accept, you authorize Building NV to furnish all materials and labor required to complete the work described above, and agree to the terms and payment schedule.
      </p>
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Your full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 bg-white border border-gray-300 rounded-sm px-4 py-3 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-gray-600"
        />
        <button
          onClick={handleAccept}
          disabled={!name.trim() || status === "loading"}
          className="bg-gray-900 text-white font-semibold px-6 py-3 rounded-sm text-sm hover:bg-gray-700 transition-colors disabled:opacity-60 whitespace-nowrap"
        >
          {status === "loading" ? "Accepting..." : "I Accept This Proposal"}
        </button>
      </div>
    </div>
  );
}
