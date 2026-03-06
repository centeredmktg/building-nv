# Building NV Website Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a single-page Next.js marketing website for Building NV, a Reno NV tenant improvement contractor, optimized for lead generation.

**Architecture:** Next.js App Router, single page with smooth-scroll anchor sections, Tailwind CSS for styling, Framer Motion for scroll-triggered animations. All content is static — no CMS, no database. Contact form submits via a Next.js API route that sends email (or logs to console for now).

**Tech Stack:** Next.js 14+, Tailwind CSS v3, Framer Motion, Geist font (built into Next.js), Vercel for hosting.

---

## Task 1: Scaffold Next.js Project

**Files:**
- Create: `package.json`, `next.config.js`, `tailwind.config.ts`, `postcss.config.js`, `tsconfig.json` (via CLI)

**Step 1: Scaffold the project**

```bash
cd /Users/dcox/building-nv
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git
```

When prompted, accept all defaults. The `--no-git` flag skips re-initializing git since we already have a repo.

**Step 2: Install Framer Motion**

```bash
npm install framer-motion
```

**Step 3: Verify dev server starts**

```bash
npm run dev
```

Open `http://localhost:3000` — should see Next.js default page.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with Tailwind and Framer Motion"
```

---

## Task 2: Global Styles and Design Tokens

**Files:**
- Modify: `src/app/globals.css`
- Modify: `tailwind.config.ts`

**Step 1: Update tailwind.config.ts with color tokens**

Replace the content of `tailwind.config.ts` with:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0A0A0A",
        surface: "#141414",
        "surface-2": "#1A1A1A",
        border: "#2A2A2A",
        "text-primary": "#E5E5E5",
        "text-muted": "#888888",
        accent: "#C9A84C",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
```

**Step 2: Update globals.css**

Replace the content of `src/app/globals.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html {
  scroll-behavior: smooth;
}

body {
  background-color: #0A0A0A;
  color: #E5E5E5;
}

@layer utilities {
  .noise {
    position: relative;
  }
  .noise::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 1;
  }
}
```

**Step 3: Verify Tailwind compiles**

```bash
npm run dev
```

No errors in terminal.

**Step 4: Commit**

```bash
git add src/app/globals.css tailwind.config.ts
git commit -m "feat: configure design tokens and global styles"
```

---

## Task 3: Root Layout and Font Setup

**Files:**
- Modify: `src/app/layout.tsx`

**Step 1: Update layout.tsx**

Replace with:

```typescript
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Building NV | Commercial Tenant Improvement | Reno, NV",
  description:
    "Building NV specializes in commercial tenant improvement projects across Reno, Nevada. Office buildouts, retail spaces, medical, and more. Get a quote today.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans bg-bg text-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
```

**Step 2: Install geist package if needed**

```bash
npm install geist
```

**Step 3: Verify no errors**

```bash
npm run dev
```

Check `http://localhost:3000` — no console errors.

**Step 4: Commit**

```bash
git add src/app/layout.tsx package.json package-lock.json
git commit -m "feat: configure root layout with Geist font and SEO metadata"
```

---

## Task 4: Nav Component

**Files:**
- Create: `src/components/Nav.tsx`

**Step 1: Create Nav component**

```typescript
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
```

**Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: no output (no errors).

**Step 3: Commit**

```bash
git add src/components/Nav.tsx
git commit -m "feat: add sticky nav with scroll-aware background"
```

---

## Task 5: FadeUp Animation Wrapper

**Files:**
- Create: `src/components/FadeUp.tsx`

**Step 1: Create reusable scroll-triggered fade-up component**

```typescript
"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface FadeUpProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export default function FadeUp({ children, delay = 0, className = "" }: FadeUpProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
```

**Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/components/FadeUp.tsx
git commit -m "feat: add FadeUp scroll-triggered animation wrapper"
```

---

## Task 6: Hero Section

**Files:**
- Create: `src/components/sections/Hero.tsx`

**Step 1: Create Hero section**

```typescript
import FadeUp from "@/components/FadeUp";

export default function Hero() {
  return (
    <section
      id="hero"
      className="noise relative min-h-screen flex flex-col items-center justify-center text-center px-6"
    >
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-bg via-bg to-surface pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto">
        <FadeUp delay={0}>
          <p className="text-accent text-sm font-semibold tracking-[0.2em] uppercase mb-6">
            Reno, Nevada
          </p>
        </FadeUp>

        <FadeUp delay={0.1}>
          <h1 className="text-[clamp(56px,10vw,112px)] font-bold leading-[0.95] tracking-tight text-text-primary mb-6">
            Building NV
          </h1>
        </FadeUp>

        <FadeUp delay={0.2}>
          <p className="text-[clamp(18px,2.5vw,28px)] text-text-muted font-light max-w-2xl mx-auto mb-10 leading-relaxed">
            Tenant Improvement. Done Right.
          </p>
        </FadeUp>

        <FadeUp delay={0.3}>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#contact"
              className="bg-accent text-bg font-semibold px-8 py-4 rounded-full text-base hover:bg-accent/90 transition-colors"
            >
              Start a Conversation
            </a>
            <a
              href="#projects"
              className="border border-border text-text-primary font-semibold px-8 py-4 rounded-full text-base hover:border-text-muted transition-colors"
            >
              View Our Work
            </a>
          </div>
        </FadeUp>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-text-muted">
        <span className="text-xs tracking-widest uppercase">Scroll</span>
        <div className="w-px h-8 bg-gradient-to-b from-text-muted to-transparent" />
      </div>
    </section>
  );
}
```

**Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/components/sections/Hero.tsx
git commit -m "feat: add hero section with animated headline and CTAs"
```

---

## Task 7: Services Section

**Files:**
- Create: `src/components/sections/Services.tsx`

**Step 1: Create Services section**

```typescript
import FadeUp from "@/components/FadeUp";

const services = [
  {
    number: "01",
    title: "Office Buildouts",
    description:
      "Complete interior construction for corporate offices, coworking spaces, and professional suites. From open floor plans to private executive spaces.",
  },
  {
    number: "02",
    title: "Retail & Restaurant",
    description:
      "High-impact commercial spaces built for customer experience. We handle the construction so you can focus on your business.",
  },
  {
    number: "03",
    title: "Medical & Healthcare",
    description:
      "Compliant, purpose-built spaces for medical offices, clinics, and healthcare facilities with attention to code and patient flow.",
  },
  {
    number: "04",
    title: "Warehouse & Industrial",
    description:
      "Functional improvements for logistics, manufacturing, and industrial tenants. Efficient buildouts that maximize your operational footprint.",
  },
  {
    number: "05",
    title: "Full Suite Renovations",
    description:
      "End-to-end gut renovations transforming dated commercial spaces into modern, functional environments ready for new tenants.",
  },
  {
    number: "06",
    title: "Property Manager Services",
    description:
      "Reliable, repeat-ready TI work for property managers who need a contractor they can trust across their portfolio.",
  },
];

export default function Services() {
  return (
    <section id="services" className="py-32 px-6">
      <div className="max-w-7xl mx-auto">
        <FadeUp>
          <div className="mb-16">
            <p className="text-accent text-sm font-semibold tracking-[0.2em] uppercase mb-4">
              What We Build
            </p>
            <h2 className="text-[clamp(36px,5vw,56px)] font-bold text-text-primary leading-tight max-w-xl">
              Commercial TI Services
            </h2>
          </div>
        </FadeUp>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
          {services.map((service, i) => (
            <FadeUp key={service.number} delay={i * 0.05}>
              <div className="bg-surface p-8 h-full hover:bg-surface-2 transition-colors group">
                <span className="text-accent text-sm font-mono mb-4 block">
                  {service.number}
                </span>
                <h3 className="text-text-primary font-semibold text-lg mb-3">
                  {service.title}
                </h3>
                <p className="text-text-muted text-sm leading-relaxed">
                  {service.description}
                </p>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}
```

**Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/components/sections/Services.tsx
git commit -m "feat: add services section with 6-card grid"
```

---

## Task 8: Trust / About Section

**Files:**
- Create: `src/components/sections/About.tsx`

**Step 1: Create About/Trust section**

```typescript
import FadeUp from "@/components/FadeUp";

const stats = [
  { value: "$3MM+", label: "Delivered" },
  { value: "Reno", label: "Based & Rooted" },
  { value: "TI", label: "Specialists" },
  { value: "First", label: "Relationships" },
];

export default function About() {
  return (
    <section id="about" className="py-32 px-6 bg-surface">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <FadeUp>
            <div>
              <p className="text-accent text-sm font-semibold tracking-[0.2em] uppercase mb-4">
                Why Building NV
              </p>
              <h2 className="text-[clamp(36px,5vw,56px)] font-bold text-text-primary leading-tight mb-6">
                We Know Commercial.{" "}
                <span className="text-text-muted">We Know Reno.</span>
              </h2>
              <p className="text-text-muted leading-relaxed mb-6">
                Building NV was built specifically for commercial tenant improvement work. We understand the relationship between property managers, landlords, and tenants — and we operate as a trusted partner across all of them.
              </p>
              <p className="text-text-muted leading-relaxed">
                Based in Reno, Nevada, we bring local knowledge, reliable crews, and transparent communication to every project. When you work with us, you get a team that picks up the phone.
              </p>
            </div>
          </FadeUp>

          <FadeUp delay={0.15}>
            <div className="grid grid-cols-2 gap-px bg-border">
              {stats.map((stat) => (
                <div key={stat.label} className="bg-surface-2 p-8">
                  <div className="text-accent text-[clamp(32px,4vw,48px)] font-bold leading-none mb-2">
                    {stat.value}
                  </div>
                  <div className="text-text-muted text-sm uppercase tracking-widest">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  );
}
```

**Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/components/sections/About.tsx
git commit -m "feat: add about/trust section with stat grid"
```

---

## Task 9: Projects Section

**Files:**
- Create: `src/components/sections/Projects.tsx`

**Step 1: Create Projects section with placeholder cards**

```typescript
import FadeUp from "@/components/FadeUp";

const projects = [
  {
    type: "Office Buildout",
    location: "South Meadows, Reno NV",
    size: "4,200 SF",
    accent: "#1A1A1A",
  },
  {
    type: "Medical Suite",
    location: "Sparks, NV",
    size: "2,800 SF",
    accent: "#1E1A14",
  },
  {
    type: "Retail Buildout",
    location: "Downtown Reno, NV",
    size: "3,100 SF",
    accent: "#161A1A",
  },
  {
    type: "Corporate Office",
    location: "North Valleys, Reno NV",
    size: "6,500 SF",
    accent: "#1A1A1A",
  },
  {
    type: "Restaurant",
    location: "Midtown Reno, NV",
    size: "2,200 SF",
    accent: "#1E1814",
  },
  {
    type: "Suite Renovation",
    location: "Reno, NV",
    size: "5,000 SF",
    accent: "#1A1A1A",
  },
];

export default function Projects() {
  return (
    <section id="projects" className="py-32 px-6">
      <div className="max-w-7xl mx-auto">
        <FadeUp>
          <div className="flex items-end justify-between mb-16">
            <div>
              <p className="text-accent text-sm font-semibold tracking-[0.2em] uppercase mb-4">
                Our Work
              </p>
              <h2 className="text-[clamp(36px,5vw,56px)] font-bold text-text-primary leading-tight">
                Recent Projects
              </h2>
            </div>
            <p className="text-text-muted text-sm max-w-xs text-right hidden md:block">
              Photography coming soon. Real project photos will be added as we document our ongoing work.
            </p>
          </div>
        </FadeUp>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project, i) => (
            <FadeUp key={i} delay={i * 0.07}>
              <div className="group relative overflow-hidden rounded-sm aspect-[4/3] cursor-default">
                {/* Placeholder image block */}
                <div
                  className="absolute inset-0 transition-transform duration-500 group-hover:scale-105"
                  style={{
                    background: `linear-gradient(135deg, ${project.accent} 0%, #0A0A0A 100%)`,
                  }}
                />
                {/* Grid texture overlay */}
                <div className="absolute inset-0 opacity-20"
                  style={{
                    backgroundImage: `repeating-linear-gradient(0deg, #333 0px, #333 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, #333 0px, #333 1px, transparent 1px, transparent 40px)`,
                  }}
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-bg/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                  <p className="text-accent text-xs font-semibold tracking-widest uppercase mb-1">
                    {project.type}
                  </p>
                  <p className="text-text-primary font-semibold">{project.location}</p>
                  <p className="text-text-muted text-sm">{project.size}</p>
                </div>
                {/* Always-visible label */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-bg to-transparent group-hover:opacity-0 transition-opacity">
                  <p className="text-text-muted text-sm">{project.type}</p>
                </div>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}
```

**Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/components/sections/Projects.tsx
git commit -m "feat: add projects section with placeholder cards and hover overlays"
```

---

## Task 10: Contact Section and API Route

**Files:**
- Create: `src/components/sections/Contact.tsx`
- Create: `src/app/api/contact/route.ts`

**Step 1: Create API route for form submission**

```typescript
// src/app/api/contact/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, company, phone, projectType, message } = body;

  // Validate required fields
  if (!name || !phone) {
    return NextResponse.json({ error: "Name and phone are required" }, { status: 400 });
  }

  // Log submission (replace with email service later, e.g. Resend)
  console.log("Contact form submission:", { name, company, phone, projectType, message });

  return NextResponse.json({ success: true });
}
```

**Step 2: Create Contact section**

```typescript
// src/components/sections/Contact.tsx
"use client";

import { useState } from "react";
import FadeUp from "@/components/FadeUp";

const projectTypes = [
  "Office Buildout",
  "Retail / Restaurant",
  "Medical Suite",
  "Warehouse / Industrial",
  "Suite Renovation",
  "Other",
];

export default function Contact() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [form, setForm] = useState({
    name: "",
    company: "",
    phone: "",
    projectType: "",
    message: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setStatus("success");
        setForm({ name: "", company: "", phone: "", projectType: "", message: "" });
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  const inputClass =
    "w-full bg-surface border border-border rounded-sm px-4 py-3 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent transition-colors";

  return (
    <section id="contact" className="py-32 px-6 bg-surface">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          <FadeUp>
            <div>
              <p className="text-accent text-sm font-semibold tracking-[0.2em] uppercase mb-4">
                Get In Touch
              </p>
              <h2 className="text-[clamp(36px,5vw,56px)] font-bold text-text-primary leading-tight mb-6">
                Let&apos;s Talk About Your Project
              </h2>
              <p className="text-text-muted leading-relaxed mb-10">
                Whether you have a space ready for buildout or are still in early planning, we want to hear about it. We respond within one business day.
              </p>
              <div className="flex flex-col gap-4">
                <a
                  href="tel:+17752000000"
                  className="flex items-center gap-3 text-text-primary hover:text-accent transition-colors group"
                >
                  <span className="text-2xl font-bold">(775) 200-0000</span>
                </a>
                <p className="text-text-muted text-sm">Reno, Nevada</p>
              </div>
            </div>
          </FadeUp>

          <FadeUp delay={0.1}>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  name="name"
                  type="text"
                  placeholder="Your Name *"
                  required
                  value={form.name}
                  onChange={handleChange}
                  className={inputClass}
                />
                <input
                  name="company"
                  type="text"
                  placeholder="Company / Property"
                  value={form.company}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <input
                name="phone"
                type="tel"
                placeholder="Phone Number *"
                required
                value={form.phone}
                onChange={handleChange}
                className={inputClass}
              />
              <select
                name="projectType"
                value={form.projectType}
                onChange={handleChange}
                className={`${inputClass} appearance-none`}
              >
                <option value="" disabled>
                  Project Type
                </option>
                {projectTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <textarea
                name="message"
                placeholder="Tell us about your project — size, timeline, location..."
                rows={5}
                value={form.message}
                onChange={handleChange}
                className={`${inputClass} resize-none`}
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full bg-accent text-bg font-semibold py-4 rounded-sm text-sm tracking-wide hover:bg-accent/90 transition-colors disabled:opacity-60"
              >
                {status === "loading" ? "Sending..." : "Send Message"}
              </button>
              {status === "success" && (
                <p className="text-accent text-sm text-center">
                  Message sent. We&apos;ll be in touch soon.
                </p>
              )}
              {status === "error" && (
                <p className="text-red-400 text-sm text-center">
                  Something went wrong. Please call us directly.
                </p>
              )}
            </form>
          </FadeUp>
        </div>
      </div>
    </section>
  );
}
```

**Step 3: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/components/sections/Contact.tsx src/app/api/contact/route.ts
git commit -m "feat: add contact section with form and API route"
```

---

## Task 11: Footer

**Files:**
- Create: `src/components/Footer.tsx`

**Step 1: Create Footer**

```typescript
export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-bg border-t border-border py-10 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-text-primary font-bold text-lg">Building NV</span>
          <p className="text-text-muted text-xs mt-1">
            Commercial Tenant Improvement · Reno, Nevada
          </p>
        </div>
        <p className="text-text-muted text-xs">
          &copy; {year} Building NV. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/Footer.tsx
git commit -m "feat: add footer"
```

---

## Task 12: Wire Up the Page

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Replace page.tsx with the assembled page**

```typescript
import Nav from "@/components/Nav";
import Hero from "@/components/sections/Hero";
import Services from "@/components/sections/Services";
import About from "@/components/sections/About";
import Projects from "@/components/sections/Projects";
import Contact from "@/components/sections/Contact";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Services />
        <About />
        <Projects />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
```

**Step 2: Run dev server and do a full visual review**

```bash
npm run dev
```

Open `http://localhost:3000` and verify:
- [ ] Nav is fixed, transparent on hero, goes solid on scroll
- [ ] Hero headline is large and centered, both CTAs visible
- [ ] Services shows 6 cards in 3-col grid (2-col on tablet, 1-col mobile)
- [ ] About section has 2-col layout with stat grid
- [ ] Projects shows 6 placeholder cards with hover overlays
- [ ] Contact has side-by-side layout with working form
- [ ] Footer shows at bottom
- [ ] Smooth scroll works on all nav links
- [ ] Fade-up animations trigger on scroll

**Step 3: Run production build to catch any issues**

```bash
npm run build
```

Expected: no errors.

**Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: wire up full page layout with all sections"
```

---

## Task 13: Vercel Deployment

**Step 1: Install Vercel CLI**

```bash
npm install -g vercel
```

**Step 2: Deploy**

```bash
vercel
```

Follow prompts:
- Set up and deploy: Yes
- Which scope: select your account
- Link to existing project: No
- Project name: `building-nv`
- Directory: `./` (default)
- Override settings: No

**Step 3: Note the deployment URL**

Vercel will output a URL like `https://building-nv.vercel.app`. Visit it and do a final visual check.

**Step 4: Set up production domain (optional now)**

Can be done later through Vercel dashboard when a custom domain is ready.

---

## Quick Reference

| Command | Purpose |
|---|---|
| `npm run dev` | Local dev server at http://localhost:3000 |
| `npm run build` | Production build check |
| `npx tsc --noEmit` | TypeScript type check |
| `vercel` | Deploy to Vercel |
| `vercel --prod` | Deploy to production URL |

## Phone Number

The contact section has a placeholder phone number `(775) 200-0000`. Replace with the real number in `src/components/sections/Contact.tsx` before going live.
