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
                <div
                  className="absolute inset-0 opacity-20"
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
