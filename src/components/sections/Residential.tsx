import FadeUp from "@/components/FadeUp";

const features = [
  {
    title: "Full Kitchen Remodels",
    description:
      "Complete gut-and-rebuild kitchen renovations — custom cabinetry, countertops, tile, fixtures, and all rough work. Built to last.",
  },
  {
    title: "Bathroom Renovations",
    description:
      "Full bathroom remodels from demo to finish. Tile, vanities, showers, soaking tubs, and everything in between.",
  },
  {
    title: "Custom Tile & Finishes",
    description:
      "Precision tile work, custom shower surrounds, flooring, and high-end finish installation. The details that make the difference.",
  },
];

export default function Residential() {
  return (
    <section id="residential" className="py-32 px-6 bg-surface-2">
      <div className="max-w-7xl mx-auto">
        <FadeUp>
          <div className="flex items-center gap-4 mb-4">
            <span className="text-accent text-sm font-semibold tracking-[0.2em] uppercase">
              Residential Services
            </span>
            <span className="h-px flex-1 max-w-[60px] bg-border" />
            <span className="text-text-muted text-xs tracking-widest uppercase">
              A separate category
            </span>
          </div>
          <h2 className="text-[clamp(36px,5vw,56px)] font-bold text-text-primary leading-tight mb-6 max-w-2xl">
            Kitchens & Bathrooms.{" "}
            <span className="text-text-muted">Done Right.</span>
          </h2>
          <p className="text-text-muted leading-relaxed max-w-xl mb-16">
            Beyond commercial work, we bring the same standard of craft to residential kitchens and bathrooms. High-end finishes, clean timelines, and a crew you can trust in your home. Serving Reno and Northern Nevada homeowners.
          </p>
        </FadeUp>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border">
          {features.map((feature, i) => (
            <FadeUp key={feature.title} delay={i * 0.08}>
              <div className="bg-surface p-8 h-full hover:bg-bg transition-colors">
                <h3 className="text-text-primary font-semibold text-lg mb-3">
                  {feature.title}
                </h3>
                <p className="text-text-muted text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}
