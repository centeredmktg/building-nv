"use client";

import { useState, useRef, useEffect } from "react";

export default function AcceptanceBlock({
  slug,
  signingToken,
  accepted,
  signerName,
  acceptedAt,
}: {
  slug: string;
  signingToken: string | null;
  accepted: boolean;
  signerName?: string;
  acceptedAt?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<any>(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done">(accepted ? "done" : "idle");
  const [finalName, setFinalName] = useState(signerName || "");
  const [finalDate, setFinalDate] = useState(acceptedAt || "");
  const [error, setError] = useState<string | null>(null);

  // Initialize SignaturePad from public/signature_pad.min.js
  useEffect(() => {
    if (status === "done") return;
    const script = document.createElement("script");
    script.src = "/signature_pad.min.js";
    script.onload = () => {
      if (canvasRef.current && (window as any).SignaturePad) {
        padRef.current = new (window as any).SignaturePad(canvasRef.current, {
          backgroundColor: "rgb(255, 255, 255)",
          penColor: "rgb(0, 0, 0)",
        });
        resizeCanvas();
      }
    };
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, [status]);

  function resizeCanvas() {
    const canvas = canvasRef.current;
    if (!canvas || !padRef.current) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    (canvas.getContext("2d") as CanvasRenderingContext2D).scale(ratio, ratio);
    padRef.current.clear();
  }

  const handleSubmit = async () => {
    if (!name.trim()) { setError("Please enter your full name."); return; }
    if (!padRef.current || padRef.current.isEmpty()) { setError("Please draw your signature."); return; }
    setError(null);
    setStatus("loading");

    const signature = padRef.current.toDataURL("image/png");

    // Use new token-based route if available, else fall back to legacy accept route
    const url = signingToken
      ? `/api/sign/quote/${signingToken}`
      : `/api/proposals/${slug}/accept`;

    const body = signingToken
      ? JSON.stringify({ signature, signerName: name })
      : JSON.stringify({ signerName: name });

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Something went wrong. Please try again.");
      setStatus("idle");
      return;
    }

    const data = await res.json();
    setFinalName(name);
    setFinalDate(data.signedAt ? new Date(data.signedAt).toLocaleString() : new Date().toLocaleString());
    setStatus("done");
  };

  if (status === "done") {
    return (
      <div className="border border-green-800 bg-green-950/30 rounded-sm p-6 print:border-border print:bg-transparent">
        <p className="text-green-400 font-semibold mb-1">Proposal Accepted</p>
        <p className="text-gray-600 text-sm">
          Signed by <span className="text-gray-900">{finalName}</span>
          {finalDate && <> on {finalDate}</>}
        </p>
      </div>
    );
  }

  return (
    <div className="border border-gray-300 rounded-sm p-6 print:hidden">
      <h3 className="text-gray-900 font-semibold mb-1">Sign This Proposal</h3>
      <p className="text-gray-600 text-sm mb-4">
        By signing below and entering your name, you authorize Building NV to proceed with the scope above and agree to the stated terms.
      </p>

      <div className="mb-4">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Full Name</label>
        <input
          type="text"
          placeholder="Your full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-white border border-gray-300 rounded-sm px-4 py-3 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-gray-600"
        />
      </div>

      <div className="mb-4">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Signature</label>
        <canvas
          ref={canvasRef}
          className="w-full border border-gray-300 rounded-sm bg-white touch-none"
          style={{ height: "160px" }}
        />
        <button
          type="button"
          onClick={() => padRef.current?.clear()}
          className="text-xs text-gray-400 hover:text-gray-600 mt-1"
        >
          Clear
        </button>
      </div>

      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={status === "loading"}
        className="w-full bg-gray-900 text-white font-semibold px-6 py-3 rounded-sm text-sm hover:bg-gray-700 transition-colors disabled:opacity-60"
      >
        {status === "loading" ? "Signing..." : "Sign This Proposal"}
      </button>
    </div>
  );
}
