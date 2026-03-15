"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Employee {
  id: string;
  legalName: string;
  tradeClassification: string;
  contact: { firstName: string; lastName: string | null; phone: string | null };
}

interface TeamMember {
  id: string;
  role: string;
  employee: Employee & {
    certifications: { type: string; verifiedStatus: string }[];
  };
}

export default function TeamAssignmentPanel({
  projectId,
  initialMembers,
  availableEmployees,
}: {
  projectId: string;
  initialMembers: TeamMember[];
  availableEmployees: Employee[];
}) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [selectedId, setSelectedId] = useState("");
  const [selectedRole, setSelectedRole] = useState("worker");
  const [adding, setAdding] = useState(false);

  const unassigned = availableEmployees.filter(
    (e) => !members.some((m) => m.employee.id === e.id)
  );

  const addMember = async () => {
    if (!selectedId) return;
    setAdding(true);
    const res = await fetch(`/api/projects/${projectId}/team`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId: selectedId, role: selectedRole }),
    });
    if (res.ok) {
      router.refresh();
    }
    setAdding(false);
    setSelectedId("");
  };

  const removeMember = async (memberId: string) => {
    await fetch(`/api/projects/${projectId}/team/${memberId}`, { method: "DELETE" });
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
  };

  const selectClass =
    "bg-surface border border-border rounded-sm px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-accent transition-colors appearance-none";

  return (
    <div>
      {members.length > 0 && (
        <div className="flex flex-col gap-2 mb-4">
          {members.map((m) => {
            const hasOsha = m.employee.certifications.some(
              (c) => (c.type === "OSHA_10" || c.type === "OSHA_30") && c.verifiedStatus === "verified"
            );
            return (
              <div key={m.id} className="flex items-center justify-between border border-border rounded-sm px-4 py-3">
                <div>
                  <p className="text-text-primary text-sm font-medium">{m.employee.legalName}</p>
                  <p className="text-text-muted text-xs">
                    {m.role} · {m.employee.contact.phone ?? "no phone"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {!hasOsha && (
                    <span className="text-xs text-yellow-400">No OSHA cert</span>
                  )}
                  <button
                    onClick={() => removeMember(m.id)}
                    className="text-text-muted text-xs hover:text-red-400 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {unassigned.length > 0 && (
        <div className="flex gap-2">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className={`flex-1 ${selectClass}`}
          >
            <option value="">Select employee to assign...</option>
            {unassigned.map((e) => (
              <option key={e.id} value={e.id}>
                {e.legalName} — {e.tradeClassification}
              </option>
            ))}
          </select>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className={selectClass}
          >
            <option value="worker">Worker</option>
            <option value="foreman">Foreman</option>
            <option value="superintendent">Superintendent</option>
          </select>
          <button
            onClick={addMember}
            disabled={!selectedId || adding}
            className="bg-accent text-bg font-semibold px-4 py-2 rounded-sm text-sm hover:bg-accent/90 transition-colors disabled:opacity-60"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
