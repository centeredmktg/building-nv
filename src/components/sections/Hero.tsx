import FadeUp from "@/components/FadeUp";

const stats = [
  { number: "$3MM+", label: "Delivered" },
  { number: "10+", label: "Years in Reno" },
  { number: "100%", label: "Licensed & Insured" },
  { number: "NV", label: "Northern Nevada Based" },
];

export default function Hero() {
  return (
    <section
      id="hero"
      className="noise relative min-h-screen flex flex-col"
    >
      {/* Grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(#2A2825 1px, transparent 1px), linear-gradient(90deg, #2A2825 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          opacity: 0.35,
        }}
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-bg via-bg/95 to-surface pointer-events-none" />

      {/* Main content */}
      <div className="relative z-10 flex-1 flex items-center">
        <div className="max-w-7xl mx-auto w-full px-6 py-32 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Left: headline + CTAs */}
          <div>
            <FadeUp delay={0}>
              <p className="flex items-center gap-3 text-accent text-xs font-bold tracking-[0.2em] uppercase mb-8">
                <span className="block w-5 h-px bg-accent" />
                Reno, Nevada
              </p>
            </FadeUp>

            <FadeUp delay={0.1}>
              <h1 className="text-[clamp(48px,7vw,88px)] font-extrabold leading-[0.97] tracking-tight text-text-primary mb-6">
                We build it.<br />
                <span className="text-accent">Done right.</span>
              </h1>
            </FadeUp>

            <FadeUp delay={0.2}>
              <p className="text-[clamp(16px,1.8vw,20px)] text-text-muted font-light max-w-md mb-10 leading-relaxed">
                General contractor serving Northern Nevada. Residential builds &amp; remodels. Commercial tenant improvement. We show up, we do the work, we stand behind it.
              </p>
            </FadeUp>

            <FadeUp delay={0.3}>
              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href="#contact"
                  className="inline-flex items-center gap-3 bg-accent text-bg font-bold px-7 py-4 text-sm tracking-widest uppercase hover:bg-accent/90 transition-colors"
                >
                  Start a Conversation
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/>
                  </svg>
                </a>
                <a
                  href="#projects"
                  className="inline-flex items-center gap-3 border border-border text-text-muted font-medium px-7 py-4 text-sm tracking-wide hover:border-text-muted hover:text-text-primary transition-colors"
                >
                  View Our Work
                </a>
              </div>
            </FadeUp>
          </div>

          {/* Right: stat grid */}
          <FadeUp delay={0.2}>
            <div className="grid grid-cols-2 gap-px bg-border border border-border">
              {stats.map((stat) => (
                <div key={stat.label} className="bg-surface p-8 relative">
                  <div className="absolute top-0 left-0 w-8 h-0.5 bg-accent" />
                  <div className="text-[clamp(28px,3.5vw,44px)] font-extrabold text-text-primary leading-none tracking-tight mb-2">
                    {stat.number}
                  </div>
                  <div className="text-text-muted text-xs font-medium uppercase tracking-widest">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </FadeUp>
        </div>
      </div>

      {/* Bottom ticker */}
      <div className="relative z-10 border-t border-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-x-10 gap-y-2">
          {["Office Buildouts", "Retail & Restaurant", "Medical Suites", "Kitchen Remodels", "Bathroom Renovations", "Suite Renovations"].map((item) => (
            <span key={item} className="flex items-center gap-2.5 text-xs font-medium tracking-[0.14em] uppercase text-text-muted">
              <span className="w-1 h-1 rounded-full bg-accent flex-shrink-0" />
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
