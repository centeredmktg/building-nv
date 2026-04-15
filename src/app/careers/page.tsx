import { prisma } from "@/lib/prisma";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import FadeUp from "@/components/FadeUp";
import ApplyForm from "./ApplyForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Careers — Building NV",
  description: "Join the Building NV team. View open positions and apply today.",
};

export default async function CareersPage() {
  const postings = await prisma.jobPosting.findMany({
    where: { status: "open" },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <Nav />
      <main className="min-h-screen">
        {/* Header */}
        <section className="pt-32 pb-16 px-6">
          <div className="max-w-7xl mx-auto">
            <FadeUp>
              <p className="text-accent text-sm font-semibold tracking-[0.2em] uppercase mb-4">
                Careers
              </p>
              <h1 className="text-[clamp(36px,5vw,56px)] font-bold text-text-primary leading-tight max-w-xl mb-6">
                Join Our Team
              </h1>
              <p className="text-text-muted text-lg max-w-2xl leading-relaxed">
                Building NV is a general contractor serving Northern Nevada. We&apos;re always
                looking for good people who want to do quality work.
              </p>
            </FadeUp>
          </div>
        </section>

        {/* Postings */}
        <section className="pb-32 px-6">
          <div className="max-w-3xl mx-auto">
            {postings.length === 0 ? (
              <FadeUp>
                <div className="border border-border rounded-sm p-12 text-center">
                  <p className="text-text-muted">
                    No open positions right now — check back soon.
                  </p>
                </div>
              </FadeUp>
            ) : (
              <div className="flex flex-col gap-6">
                {postings.map((posting, i) => (
                  <FadeUp key={posting.id} delay={i * 0.05}>
                    <details className="group border border-border rounded-sm bg-surface">
                      <summary className="flex items-center justify-between px-6 py-5 cursor-pointer list-none hover:bg-surface-2 transition-colors">
                        <div>
                          <h2 className="text-text-primary font-semibold text-lg">
                            {posting.title}
                          </h2>
                          <p className="text-text-muted text-sm mt-1">
                            {posting.location} · {posting.type.charAt(0).toUpperCase() + posting.type.slice(1)}
                          </p>
                        </div>
                        <span className="text-accent text-sm font-medium group-open:hidden">
                          Apply &rarr;
                        </span>
                        <span className="text-text-muted text-sm hidden group-open:inline">
                          &times; Close
                        </span>
                      </summary>
                      <div className="px-6 pb-6 pt-2 border-t border-border">
                        <p className="text-text-muted text-sm whitespace-pre-wrap mb-8">
                          {posting.description}
                        </p>
                        <ApplyForm jobPostingId={posting.id} jobTitle={posting.title} />
                      </div>
                    </details>
                  </FadeUp>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
