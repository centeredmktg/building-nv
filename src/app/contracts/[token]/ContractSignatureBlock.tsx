'use client';

import { useState, useRef, useEffect } from 'react';

export default function ContractSignatureBlock({ token, contractId }: { token: string; contractId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<any>(null);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [signedAt, setSignedAt] = useState<string | null>(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = '/signature_pad.min.js';
    script.onload = () => {
      if (canvasRef.current && (window as any).SignaturePad) {
        padRef.current = new (window as any).SignaturePad(canvasRef.current, {
          backgroundColor: 'rgb(255, 255, 255)',
          penColor: 'rgb(0, 0, 0)',
        });
        resizeCanvas();
      }
    };
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, []);

  function resizeCanvas() {
    const canvas = canvasRef.current;
    if (!canvas || !padRef.current) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const height = canvas.offsetHeight || 120;
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = height * ratio;
    (canvas.getContext('2d') as CanvasRenderingContext2D).scale(ratio, ratio);
    padRef.current.clear();
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!padRef.current || padRef.current.isEmpty()) {
      setError('Please draw your signature.');
      return;
    }
    setError(null);
    setStatus('loading');

    const signature = padRef.current.toDataURL('image/png');
    const res = await fetch(`/api/sign/contract/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signature, signerName: name }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Something went wrong. Please try again.');
      setStatus('idle');
      return;
    }

    const data = await res.json();
    setSignedAt(data.signedAt ? new Date(data.signedAt).toLocaleString() : new Date().toLocaleString());
    setStatus('done');
  };

  if (status === 'done') {
    return (
      <div className="bg-green-50 border border-green-200 rounded p-6">
        <p className="text-green-700 font-semibold">Contract Signed</p>
        <p className="text-gray-600 text-sm mt-1">
          Signed by {name}
          {signedAt && ` on ${signedAt}`}
        </p>
        <p className="text-gray-500 text-sm mt-2">A copy of the signed contract will be emailed to you.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-300 rounded p-6">
      <h3 className="font-semibold text-gray-900 mb-1">Execute Contract</h3>
      <p className="text-gray-600 text-sm mb-4">
        By signing below, you agree to the terms of this Master Service Agreement and authorize Building NV to proceed.
      </p>

      <div className="mb-4">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Full Name</label>
        <input
          type="text"
          placeholder="Your full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-white border border-gray-300 rounded px-4 py-3 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-gray-600"
        />
      </div>

      <div className="mb-4">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Signature</label>
        <canvas
          ref={canvasRef}
          className="w-full border border-gray-300 rounded bg-white touch-none"
          style={{ height: '160px', touchAction: 'none' }}
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
        disabled={status === 'loading'}
        className="w-full bg-gray-900 text-white font-semibold px-6 py-3 rounded text-sm hover:bg-gray-700 transition-colors disabled:opacity-60"
      >
        {status === 'loading' ? 'Signing...' : 'Execute Contract'}
      </button>
    </div>
  );
}
