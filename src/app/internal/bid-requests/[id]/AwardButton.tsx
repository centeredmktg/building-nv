"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  bidRequestId: string;
  responseId: string;
  invitationId: string;
  subName: string;
}

export default function AwardButton({ bidRequestId, responseId, invitationId, subName }: Props) {
  const router = useRouter();
  const [awarding, setAwarding] = useState(false);

  const handleAward = async () => {
    if (!confirm(`Award this bid to ${subName}? Other responses will be marked as rejected.`)) return;

    setAwarding(true);
    try {
      const res = await fetch(`/api/bid-requests/${bidRequestId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "awarded" }),
      });

      if (res.ok) {
        await fetch(`/api/bid-requests/${bidRequestId}/invitations/${invitationId}/response`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "accepted" }),
        });

        router.refresh();
      }
    } catch {
      setAwarding(false);
    }
  };

  return (
    <button
      onClick={handleAward}
      disabled={awarding}
      className="mt-2 bg-green-600 text-white px-3 py-1.5 rounded-sm text-xs hover:bg-green-700 transition-colors disabled:opacity-50"
    >
      {awarding ? "Awarding…" : "Award Bid"}
    </button>
  );
}
