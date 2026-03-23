"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-text-primary mb-2">Building NV</h1>
        <p className="text-text-muted text-sm mb-8">Internal Portal</p>
        <button
          onClick={() => signIn("google", { callbackUrl: "/internal/quotes" })}
          className="w-full bg-accent text-bg font-semibold py-3 rounded-sm text-sm hover:bg-accent/90 transition-colors"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
