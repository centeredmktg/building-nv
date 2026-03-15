import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

export default async function SafetyPlanPrintPage({
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
              certifications: { select: { type: true, verifiedStatus: true } },
            },
          },
        },
        orderBy: { role: "asc" },
      },
    },
  });

  if (!project) notFound();

  const siteAddress = project.siteAddress
    ? `${project.siteAddress}, ${project.siteCity}, ${project.siteState} ${project.siteZip}`
    : "Address not set";

  const generatedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const superintendent = project.teamMembers.find((m) => m.role === "superintendent");

  return (
    <div className="print-page">
      <style>{`
        @media print {
          body { margin: 0; font-family: Arial, sans-serif; font-size: 11pt; color: #000; }
          .no-print { display: none !important; }
          .print-page { padding: 0.75in; }
          h1 { font-size: 16pt; margin-bottom: 4pt; }
          h2 { font-size: 12pt; margin-top: 16pt; margin-bottom: 6pt; border-bottom: 1px solid #000; padding-bottom: 3pt; }
          table { width: 100%; border-collapse: collapse; font-size: 10pt; }
          th { text-align: left; font-weight: bold; border-bottom: 1px solid #000; padding: 4pt 0; }
          td { padding: 4pt 0; border-bottom: 1px solid #eee; vertical-align: top; }
          .meta { font-size: 10pt; color: #444; }
          .emergency-box { border: 2px solid #000; padding: 8pt; margin: 8pt 0; }
          .emergency-box h2 { border-bottom: none; margin-top: 0; }
          .bold { font-weight: bold; }
          .hazard-box { border: 1px solid #999; padding: 8pt; margin: 8pt 0; background: #f9f9f9; }
        }
        @media screen {
          .print-page { max-width: 800px; margin: 2rem auto; padding: 2rem; font-family: Arial, sans-serif; font-size: 14px; }
          h1 { font-size: 20px; }
          h2 { font-size: 14px; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 24px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 6px 0; border-bottom: 1px solid #eee; text-align: left; }
          .emergency-box { border: 2px solid #000; padding: 12px; margin: 12px 0; }
          .hazard-box { border: 1px solid #999; padding: 12px; background: #f9f9f9; }
          .no-print { margin-bottom: 1rem; }
        }
      `}</style>

      <div className="no-print" style={{ marginBottom: "1rem" }}>
        <PrintButton />
      </div>

      <h1>{project.name} — Job Site Safety Plan</h1>
      <p className="meta">
        Site: {siteAddress}<br />
        Generated: {generatedDate}<br />
        {superintendent && <>Superintendent: {superintendent.employee.legalName} · {superintendent.employee.contact.phone ?? "no phone"}</>}
      </p>

      <div className="emergency-box">
        <h2>EMERGENCY CONTACTS</h2>
        <table>
          <tbody>
            <tr><td className="bold">911</td><td>All life-threatening emergencies</td></tr>
            <tr><td className="bold">Poison Control</td><td>1-800-222-1222</td></tr>
            <tr><td className="bold">Nevada OSHA</td><td>(775) 688-3045</td></tr>
            {project.nearestER && (
              <tr>
                <td className="bold">Nearest ER</td>
                <td>{project.nearestER}{project.nearestERAddress ? ` — ${project.nearestERAddress}` : ""}</td>
              </tr>
            )}
            {project.assemblyPoint && (
              <tr><td className="bold">Assembly Point</td><td>{project.assemblyPoint}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h2>TEAM PHONE TREE</h2>
      {project.teamMembers.length === 0 ? (
        <p>No team members assigned.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Cell</th>
              <th>Emergency Contact</th>
            </tr>
          </thead>
          <tbody>
            {project.teamMembers.map((m) => (
              <tr key={m.id}>
                <td>{m.employee.legalName}</td>
                <td style={{ textTransform: "capitalize" }}>{m.role}</td>
                <td>{m.employee.contact.phone ?? "—"}</td>
                <td>{m.employee.ec1Name} ({m.employee.ec1Relationship}): {m.employee.ec1Phone}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {project.hazardNotes && (
        <>
          <h2>SITE-SPECIFIC HAZARDS</h2>
          <div className="hazard-box">
            <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{project.hazardNotes}</p>
          </div>
        </>
      )}
    </div>
  );
}
