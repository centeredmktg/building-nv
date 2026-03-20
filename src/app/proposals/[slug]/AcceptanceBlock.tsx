'use client';
import { useEffect, useRef, useState } from 'react';
import SignaturePad from 'signature_pad';

export default function AcceptanceBlock({
  slug,
  token,
  accepted,
  signerName: initialName,
  acceptedAt: initialDate,
}: {
  slug: string;
  token?: string;
  accepted: boolean;
  signerName?: string;
  acceptedAt?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>(accepted ? 'done' : 'idle');
  const [finalName, setFinalName] = useState(initialName ?? '');
  const [finalDate, setFinalDate] = useState(initialDate ?? '');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    padRef.current = new SignaturePad(canvas, { backgroundColor: 'rgb(249,250,251)' });

    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const data = padRef.current?.toData();
      const height = canvas.offsetHeight || 120; // fallback to CSS height
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = height * ratio;
      canvas.getContext('2d')?.scale(ratio, ratio);
      padRef.current?.clear();
      if (data) padRef.current?.fromData(data);
    };

    window.addEventListener('resize', resize);
    resize();
    return () => window.removeEventListener('resize', resize);
  }, []); // Run once on mount only — status change must not re-initialize the pad

  const handleClear = () => padRef.current?.clear();

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Please enter your full name.'); return; }
    if (!padRef.current || padRef.current.isEmpty()) { setError('Please sign before submitting.'); return; }
    setError('');
    setStatus('loading');

    const signature = padRef.current.toDataURL('image/png');

    // Use token-based route if token is available, otherwise fall back to legacy
    const url = token
      ? `/api/sign/quote/${token}`
      : `/api/proposals/${slug}/accept`;

    const body = token
      ? JSON.stringify({ signature, signerName: name })
      : JSON.stringify({ signerName: name });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Something went wrong. Please try again.');
      setStatus('idle');
      return;
    }

    const data = await res.json();
    setFinalName(name);
    setFinalDate(data.signedAt ? new Date(data.signedAt).toLocaleString() : new Date().toLocaleString());
    setStatus('done');
  };

  if (status === 'done') {
    return (
      <div className="border border-green-800 bg-green-950/30 rounded-sm p-6">
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
      <h3 className="text-gray-900 font-semibold mb-1">Acceptance of Proposal</h3>
      <p className="text-gray-600 text-sm mb-4">
        By signing below and clicking Submit, you authorize Building NV to furnish all materials and labor required to complete the work described above, and agree to the terms and payment schedule.
      </p>

      <div className="mb-4">
        <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Full Name</label>
        <input
          type="text"
          placeholder="Your full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-white border border-gray-300 rounded-sm px-4 py-3 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-gray-600"
        />
      </div>

      <div className="mb-2">
        <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Signature</label>
        <canvas
          ref={canvasRef}
          className="w-full border border-gray-300 rounded-sm bg-gray-50"
          style={{ height: '120px', touchAction: 'none' }}
        />
      </div>

      <div className="flex justify-between items-center mb-4">
        <button
          type="button"
          onClick={handleClear}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Clear signature
        </button>
      </div>

      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={status === 'loading'}
        className="w-full bg-gray-900 text-white font-semibold px-6 py-3 rounded-sm text-sm hover:bg-gray-700 transition-colors disabled:opacity-60"
      >
        {status === 'loading' ? 'Submitting\u2026' : 'Submit Signed Proposal'}
      </button>
    </div>
  );
}
