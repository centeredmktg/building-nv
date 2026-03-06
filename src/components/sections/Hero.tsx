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
