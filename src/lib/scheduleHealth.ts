import { Milestone } from "@/lib/crmTypes";

export type HealthColor = "gray" | "green" | "yellow" | "red";

export function getScheduleHealth(milestones: Milestone[]): HealthColor {
  if (milestones.length === 0) return "gray";

  const incomplete = milestones.filter((m) => !m.completedAt);
  if (incomplete.length === 0) return "green";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const threeDaysOut = new Date(today);
  threeDaysOut.setDate(threeDaysOut.getDate() + 3);

  for (const m of incomplete) {
    if (!m.plannedDate) continue;
    const planned = new Date(m.plannedDate);
    if (planned < today) return "red";
  }

  const nextMilestone = incomplete.find((m) => m.plannedDate);
  if (nextMilestone?.plannedDate) {
    const planned = new Date(nextMilestone.plannedDate);
    if (planned <= threeDaysOut) return "yellow";
  }

  return "green";
}

export function getNextMilestone(milestones: Milestone[]): Milestone | null {
  return milestones.find((m) => !m.completedAt) ?? null;
}
