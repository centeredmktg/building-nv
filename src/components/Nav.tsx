"use client";

import { useEffect, useState } from "react";

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-bg/95 backdrop-blur-sm border-b border-border"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <a href="#hero" className="flex items-center gap-3 group">
          <svg width="26" height="22" viewBox="0 0 26 22" fill="none" aria-hidden="true">
            <path d="M1 11 L13 2 L25 11" stroke="#F5F2ED" strokeWidth="2" strokeLinecap="square" fill="none"/>
            <line x1="6" y1="11" x2="6" y2="20" stroke="#F5F2ED" strokeWidth="1.5" strokeLinecap="square"/>
            <line x1="20" y1="11" x2="20" y2="20" stroke="#F5F2ED" strokeWidth="1.5" strokeLinecap="square"/>
            <line x1="1" y1="20" x2="25" y2="20" stroke="#C17F3A" strokeWidth="1.5" strokeLinecap="square"/>
          </svg>
          <span className="text-base font-extrabold text-text-primary tracking-wide">
            Building <span className="text-sm">NV</span>
          </span>
        </a>

        <div className="hidden md:flex items-center gap-8">
          <a href="#services" className="text-text-muted hover:text-text-primary transition-colors text-sm font-medium tracking-wide">
            Services
          </a>
          <a href="#projects" className="text-text-muted hover:text-text-primary transition-colors text-sm font-medium tracking-wide">
            Projects
          </a>
          <a href="#about" className="text-text-muted hover:text-text-primary transition-colors text-sm font-medium tracking-wide">
            About
          </a>
          <a
            href="#contact"
            className="bg-accent text-bg text-xs font-bold px-5 py-2.5 tracking-widest uppercase hover:bg-accent/90 transition-colors"
          >
            Let&apos;s Talk
          </a>
        </div>

        {/* Mobile CTA */}
        <a
          href="#contact"
          className="md:hidden bg-accent text-bg text-xs font-bold px-4 py-2 tracking-widest uppercase"
        >
          Let&apos;s Talk
        </a>
      </div>
    </nav>
  );
}
