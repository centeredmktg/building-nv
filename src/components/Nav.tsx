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
        <a href="#hero" className="text-xl font-bold text-text-primary tracking-tight">
          Building NV
        </a>

        <div className="hidden md:flex items-center gap-8">
          <a href="#services" className="text-text-muted hover:text-text-primary transition-colors text-sm">
            Services
          </a>
          <a href="#projects" className="text-text-muted hover:text-text-primary transition-colors text-sm">
            Projects
          </a>
          <a href="#about" className="text-text-muted hover:text-text-primary transition-colors text-sm">
            About
          </a>
          <a
            href="#contact"
            className="bg-accent text-bg text-sm font-semibold px-5 py-2 rounded-full hover:bg-accent/90 transition-colors"
          >
            Let&apos;s Talk
          </a>
        </div>

        {/* Mobile CTA */}
        <a
          href="#contact"
          className="md:hidden bg-accent text-bg text-sm font-semibold px-4 py-2 rounded-full"
        >
          Let&apos;s Talk
        </a>
      </div>
    </nav>
  );
}
