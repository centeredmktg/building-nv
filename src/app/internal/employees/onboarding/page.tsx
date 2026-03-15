import { prisma } from "@/lib/prisma";
import InviteForm from "./InviteForm";

export const dynamic = "force-dynamic";

export default async function OnboardingInvitePage() {
  const invites = await prisma.onboardingInvite.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-text-primary mb-8">Send Onboarding Invite</h1>
      <div className="border border-border rounded-sm p-6 mb-8">
        <InviteForm />
      </div>

      <h2 className="text-text-primary font-semibold mb-4">Recent Invites</h2>
      {invites.length === 0 ? (
        <p className="text-text-muted text-sm">No invites sent yet.</p>
      ) : (
        <div className="border border-border rounded-sm divide-y divide-border">
          {invites.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-text-primary text-sm">{inv.email}</p>
                <p className="text-text-muted text-xs mt-0.5">
                  Expires: {inv.expiresAt.toLocaleDateString()}
                </p>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-sm ${
                  inv.status === "completed"
                    ? "bg-green-500/10 text-green-400 border border-green-500/20"
                    : inv.status === "expired"
                    ? "bg-red-500/10 text-red-400 border border-red-500/20"
                    : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                }`}
              >
                {inv.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
