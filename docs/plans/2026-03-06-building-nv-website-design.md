# Building NV Website Design

## Overview

A single-page marketing website for Building NV, a Reno, NV construction company specializing in commercial tenant improvement (TI) projects. Primary goal: lead generation (get visitors to call or submit contact info). Secondary goal: demonstrate credibility through project work.

## Audience

- **Primary:** Property managers and commercial landlords seeking TI contractors
- **Secondary:** Commercial tenants moving into new spaces

## Tech Stack

- **Framework:** Next.js (App Router)
- **Styling:** Tailwind CSS
- **Animation:** Framer Motion (subtle scroll-triggered fade-in-up)
- **Hosting:** Vercel (free tier)
- **Fonts:** Geist (bundled with Next.js)

## Design Direction

**Option A — Minimal Bold.** Dark, typography-led, premium feel. Signals competence and seriousness without looking like a generic contractor site. Built to accept real project photography as a dramatic upgrade when available.

## Color System

| Token | Value | Usage |
|---|---|---|
| Background | `#0A0A0A` | Page background |
| Surface | `#141414` / `#1A1A1A` | Cards, nav |
| Border | `#2A2A2A` | Dividers, card borders |
| Text primary | `#E5E5E5` | Body copy |
| Text muted | `#888888` | Labels, captions |
| Accent | `#C9A84C` | CTAs, highlights, focus states |

## Typography

- **Typeface:** Geist (geometric sans-serif)
- **Hero headline:** `clamp(72px, 10vw, 120px)`, bold
- **Section headers:** `~48px`, uppercase, wide letter-spacing
- **Body:** Regular weight, `1.6` line-height
- **Tagline:** `"Tenant Improvement. Done Right. Reno, NV."`

## Page Sections (Top to Bottom)

### 1. Nav
- Fixed position, transparent over hero, solid `#0A0A0A` + blur on scroll
- Left: "Building NV" text logo (bold, white)
- Right: Anchor links (Services, Projects, About) + "Let's Talk" pill button in accent gold

### 2. Hero
- Full viewport height
- "Building NV" massive headline
- Tagline below
- Single CTA: "Let's Talk" button
- Subtle CSS noise/grain texture on background for depth

### 3. Services
- 3-column card grid
- Dark surface cards (`#1A1A1A`), numbered or icon
- Target services: Office Buildouts, Retail Spaces, Medical/Healthcare, Restaurant, Warehouse/Industrial
- Short title + 1–2 sentence description per card

### 4. Why Building NV
- Horizontal trust bar with 4 stats/signals
  - `$3MM+ Delivered`
  - `Reno-Based`
  - `Commercial Specialists`
  - `Relationships First`
- Separated by vertical dividers

### 5. Projects
- 2–3 column card grid
- Placeholder grey image blocks (dark gradient, intentional-looking)
- Hover overlay: project type + location
- Swap-ready for real photography

### 6. Contact
- Two-column layout
  - Left: Strong headline + phone number (prominent)
  - Right: Form (Name, Company, Phone, Project Type, Message)
- Form fields: dark styled with accent gold focus states
- Submit button: accent gold, full width

### 7. Footer
- Minimal: logo, tagline, Reno NV, copyright

## Interactions

- Scroll-triggered fade-in-up on each section (Framer Motion)
- Nav background transition on scroll
- Card hover states (subtle border/lift)
- Form field focus states in accent gold
- No heavy animations — performance first

## Placeholder Strategy

Images use dark grey gradient blocks with subtle texture. They look intentional and will be dramatically upgraded when real project photos are available.

## Future Considerations

- Expand to multi-page for SEO (Services, Projects, About pages)
- Add real logo once branding is finalized
- Color palette expansion (accent colors beyond gold)
- Blog/case studies for SEO content
