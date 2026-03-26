'use client';

import { useState } from 'react';

export default function PasscodeGate({
  invoiceId,
  token,
  alreadyViewed,
}: {
  invoiceId: string;
  token: string;
  alreadyViewed: boolean;
}) {
  const [passcode, setPasscode] = useState('');
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(false);

  const verify = async () => {
    if (passcode.length !== 6) {
      setError('Enter a 6-digit passcode.');
      return;
    }

    setLoading(true);
    setError('');

    const res = await fetch(
      `/api/invoices/${invoiceId}/html?token=${token}&passcode=${passcode}`
    );

    if (res.ok) {
      setVerified(true);
    } else if (res.status === 429) {
      setLocked(true);
      setError('Too many attempts. Please contact Building NV for assistance.');
    } else if (res.status === 403) {
      setError('Incorrect passcode. Please try again.');
    } else {
      setError('Something went wrong. Please try again.');
    }

    setLoading(false);
  };

  if (locked) {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-6 text-center">
        <p className="text-red-700 font-semibold">Access Temporarily Locked</p>
        <p className="text-gray-600 text-sm mt-2">
          Too many incorrect attempts. Please contact Building NV at{' '}
          <a href="mailto:danny@buildingnv.us" className="text-blue-600 underline">
            danny@buildingnv.us
          </a>{' '}
          for assistance.
        </p>
      </div>
    );
  }

  if (verified) {
    return (
      <div className="bg-white border border-gray-200 rounded" style={{ height: '80vh' }}>
        <iframe
          src={`/api/invoices/${invoiceId}/html?token=${token}&passcode=${passcode}`}
          className="w-full h-full rounded"
          title="Invoice"
        />
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto mt-12">
      <div className="bg-white border border-gray-200 rounded p-8 text-center">
        <p className="text-gray-900 font-semibold text-lg mb-2">Enter Passcode</p>
        <p className="text-gray-500 text-sm mb-6">
          A 6-digit passcode was shared with you separately.
        </p>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={passcode}
          onChange={(e) => setPasscode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') verify();
          }}
          placeholder="000000"
          className="w-full text-center text-2xl font-mono tracking-[0.3em] border border-gray-300 rounded px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
        <button
          onClick={verify}
          disabled={loading || passcode.length !== 6}
          className="w-full bg-gray-900 text-white font-semibold py-3 rounded text-sm hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          {loading ? 'Verifying...' : 'View Invoice'}
        </button>
      </div>
    </div>
  );
}
