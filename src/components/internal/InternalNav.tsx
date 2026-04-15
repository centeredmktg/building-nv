"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function InternalNav() {
  const pathname = usePathname();

  const navLink = (href: string, label: string, exact = false) => (
    <Link
      href={href}
      className={`text-sm transition-colors ${
        (exact ? pathname === href : pathname.startsWith(href))
          ? "text-text-primary font-semibold"
          : "text-text-muted hover:text-text-primary"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <nav className="border-b border-border bg-surface px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-8">
        <Link href="/internal/quotes" className="text-text-primary font-bold text-lg">
          Building NV
        </Link>
        {navLink("/internal/projects", "Pipeline", true)}
        {navLink("/internal/jobs", "Jobs")}
        {navLink("/internal/quotes", "Quotes")}
        {navLink("/internal/employees", "Employees")}
        {navLink("/internal/vendors", "Vendors")}
        {navLink("/internal/components", "Catalog")}
        {navLink("/internal/details", "Details")}
        {navLink("/internal/floor-plans", "Floor Plans")}
        {navLink("/internal/subcontractors", "Subs")}
        {navLink("/internal/bid-requests", "Bids")}
        {navLink("/internal/careers", "Careers")}
      </div>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="text-text-muted hover:text-text-primary text-sm transition-colors"
      >
        Sign Out
      </button>
    </nav>
  );
}
