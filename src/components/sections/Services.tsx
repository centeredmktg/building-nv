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
