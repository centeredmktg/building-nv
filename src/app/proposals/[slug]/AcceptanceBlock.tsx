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
    padRef.current = new SignaturePad(canvas, { backgroundColor: 'rgb(250,249,246)' });

    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const data = padRef.current?.toData();
      const height = canvas.offsetHeight || 120;
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = height * ratio;
      canvas.getContext('2d')?.scale(ratio, ratio);
      padRef.current?.clear();
      if (data) padRef.current?.fromData(data);
    };

    window.addEventListener('resize', resize);
    resize();
    return () => window.removeEventListener('resize', resize);
  }, []);

  const handleClear = () => padRef.current?.clear();

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Please enter your full name.'); return; }
    if (!padRef.current || padRef.current.isEmpty()) { setError('Please sign before submitting.'); return; }
    setError('');
    setStatus('loading');

    const signature = padRef.current.toDataURL('image/png');

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
      <div className="border-2 border-[#2D6B4A] bg-[#F0F7F3] rounded px-6 py-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-5 h-5 rounded-full bg-[#2D6B4A] flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-[#2D6B4A] font-bold text-sm">Proposal Accepted</p>
        </div>
        <p className="text-[#4A4540] text-sm ml-7">
          Signed by <span className="font-semibold text-[#1A1917]">{finalName}</span>
          {finalDate && <> on {finalDate}</>}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E8E4DD] rounded overflow-hidden print:hidden">
      <div className="bg-[#1E2A38] px-6 py-4">
        <h3 className="text-white font-bold text-sm">Acceptance of Proposal</h3>
        <p className="text-[#8A9BB0] text-xs mt-1 leading-relaxed">
          By signing below and clicking Submit, you authorize Building NV to furnish all materials and labor required to complete the work described above, and agree to the terms and payment schedule.
        </p>
      </div>

      <div className="px-6 py-5">
        <div className="mb-4">
          <label className="block text-[10px] font-bold text-[#C17F3A] uppercase tracking-[0.2em] mb-1.5">Full Name</label>
          <input
            type="text"
            placeholder="Your full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-[#FAFAF7] border border-[#E8E4DD] rounded px-4 py-3 text-[#1A1917] placeholder-[#B5B0AA] text-sm focus:outline-none focus:border-[#C17F3A] transition-colors"
          />
        </div>

        <div className="mb-2">
          <label className="block text-[10px] font-bold text-[#C17F3A] uppercase tracking-[0.2em] mb-1.5">Signature</label>
          <canvas
            ref={canvasRef}
            className="w-full border border-[#E8E4DD] rounded bg-[#FAFAF7]"
            style={{ height: '120px', touchAction: 'none' }}
          />
        </div>

        <div className="flex justify-between items-center mb-4">
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-[#9A9591] hover:text-[#C17F3A] transition-colors"
          >
            Clear signature
          </button>
        </div>

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={status === 'loading'}
          className="w-full bg-[#C17F3A] text-white font-bold px-6 py-3.5 rounded text-sm hover:bg-[#A96B2E] transition-colors disabled:opacity-60 uppercase tracking-wider"
        >
          {status === 'loading' ? 'Submitting\u2026' : 'Submit Signed Proposal'}
        </button>
      </div>
    </div>
  );
}
