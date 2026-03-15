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
                Building NV does residential and commercial work — custom builds, remodels, and tenant improvement. We understand the relationship between property managers, landlords, tenants, and homeowners, and we operate as a trusted partner across all of them.
              </p>
              <p className="text-text-muted leading-relaxed">
                Based in Reno, Nevada. Family owned. We bring local knowledge, reliable crews, and straight communication to every project. When you work with us, you get a team that picks up the phone.
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
