"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";

export default function InternalNav() {
  return (
    <nav className="border-b border-border bg-surface px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-8">
        <Link href="/internal/quotes" className="text-text-primary font-bold text-lg">
          Building NV
        </Link>
        <Link href="/internal/quotes" className="text-text-muted hover:text-text-primary text-sm transition-colors">
          Quotes
        </Link>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: "/internal/login" })}
        className="text-text-muted hover:text-text-primary text-sm transition-colors"
      >
        Sign Out
      </button>
    </nav>
  );
}
