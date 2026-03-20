"use client";

import { useRouter } from "next/navigation";
import { JobProject } from "@/lib/crmTypes";
import JobCard from "./JobCard";

export default function JobsBoard({
  projects,
  showComplete,
}: {
  projects: JobProject[];
  showComplete: boolean;
}) {
  const router = useRouter();

  const toggleComplete = () => {
    router.push(`/internal/jobs${showComplete ? "" : "?includeComplete=true"}`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Jobs</h1>
          <p className="text-text-muted text-sm mt-0.5">
            <span className="text-accent font-semibold">{projects.length}</span> active jobs
          </p>
        </div>
        <button
          onClick={toggleComplete}
          className={`text-xs px-3 py-1.5 rounded-sm border transition-colors ${
            showComplete
              ? "border-accent text-accent"
              : "border-border text-text-muted hover:text-text-primary"
          }`}
        >
          {showComplete ? "Hide Complete" : "Show Complete"}
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-text-muted text-sm">No active jobs.</p>
          <p className="text-text-muted text-xs mt-1">Activate a project from the Pipeline to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => (
            <JobCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}
