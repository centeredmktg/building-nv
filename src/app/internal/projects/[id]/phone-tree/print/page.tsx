import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

export default async function PhoneTreePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      teamMembers: {
        include: {
          employee: {
            include: {
              contact: { select: { firstName: true, lastName: true, phone: true } },
            },
          },
        },
        orderBy: { role: "asc" },
      },
    },
  });

  if (!project) notFound();

  const generatedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div style={{ maxWidth: "700px", margin: "2rem auto", padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      <style>{`
        @media print {
          body { margin: 0; font-family: Arial, sans-serif; }
          div { max-width: none !important; margin: 0 !important; padding: 0.75in !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print" style={{ marginBottom: "1rem" }}>
        <PrintButton />
      </div>

      <h1 style={{ fontSize: "18px", marginBottom: "4px" }}>{project.name}</h1>
      <p style={{ fontSize: "12px", color: "#666", marginBottom: "20px" }}>
        Emergency Phone Tree · Generated {generatedDate}
      </p>

      <p style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "4px" }}>EMERGENCY: 911</p>
      <p style={{ fontSize: "12px", color: "#666", marginBottom: "20px" }}>
        Poison Control: 1-800-222-1222 · Nevada OSHA: (775) 688-3045
      </p>

      {project.teamMembers.length === 0 ? (
        <p style={{ fontSize: "12px", color: "#666" }}>No team members assigned to this project.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #000" }}>
              <th style={{ textAlign: "left", padding: "6px 0" }}>Name</th>
              <th style={{ textAlign: "left", padding: "6px 0" }}>Role</th>
              <th style={{ textAlign: "left", padding: "6px 0" }}>Cell</th>
              <th style={{ textAlign: "left", padding: "6px 0" }}>Emergency Contact</th>
            </tr>
          </thead>
          <tbody>
            {project.teamMembers.map((m) => (
              <tr key={m.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "6px 0" }}>{m.employee.legalName}</td>
                <td style={{ padding: "6px 0", textTransform: "capitalize" }}>{m.role}</td>
                <td style={{ padding: "6px 0" }}>{m.employee.contact.phone ?? "—"}</td>
                <td style={{ padding: "6px 0" }}>
                  {m.employee.ec1Name} ({m.employee.ec1Relationship})<br />
                  <span style={{ color: "#444" }}>{m.employee.ec1Phone}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
