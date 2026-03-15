import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

export default async function BinderPrintPage({
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
      quotes: {
        include: {
          sections: {
            include: {
              items: {
                include: {
                  component: { select: { name: true, sdsUrl: true, isHazardous: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!project) notFound();

  const siteAddress = project.siteAddress
    ? `${project.siteAddress}, ${project.siteCity}, ${project.siteState} ${project.siteZip}`
    : "Address not set";

  const superintendent = project.teamMembers.find((m) => m.role === "superintendent");
  const generatedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  // Derive hazardous materials from quote line items
  const hazardousMaterials = project.quotes.flatMap((q) =>
    q.sections.flatMap((s) =>
      s.items
        .filter((i) => i.component?.isHazardous)
        .map((i) => ({
          name: i.component!.name,
          sdsUrl: i.component!.sdsUrl,
        }))
    )
  );
  const uniqueHazardous = Array.from(
    new Map(hazardousMaterials.map((m) => [m.name, m])).values()
  );

  const unlinkedItems = project.quotes.flatMap((q) =>
    q.sections.flatMap((s) =>
      s.items.filter((i) => !i.component).map((i) => i.description)
    )
  );

  return (
    <div className="print-page">
      <style>{`
        @media print {
          body { margin: 0; font-family: Arial, sans-serif; font-size: 11pt; color: #000; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
          .print-page { padding: 0.75in; }
          h1 { font-size: 16pt; }
          h2 { font-size: 13pt; margin-top: 20pt; border-bottom: 1.5px solid #000; padding-bottom: 4pt; }
          h3 { font-size: 11pt; margin-top: 14pt; }
          table { width: 100%; border-collapse: collapse; }
          th { text-align: left; border-bottom: 1px solid #000; padding: 4pt 0; font-size: 10pt; }
          td { padding: 4pt 0; border-bottom: 1px solid #eee; vertical-align: top; font-size: 10pt; }
          .box { border: 2px solid #000; padding: 8pt; margin: 8pt 0; }
          .warning-box { border: 1px solid #999; padding: 8pt; background: #f5f5f5; }
          ul { margin: 4pt 0; padding-left: 16pt; }
          li { margin: 2pt 0; }
        }
        @media screen {
          .print-page { max-width: 850px; margin: 2rem auto; padding: 2rem; font-family: Arial, sans-serif; }
          h1 { font-size: 22px; }
          h2 { font-size: 16px; border-bottom: 1px solid #ccc; padding-bottom: 6px; margin-top: 28px; }
          h3 { font-size: 13px; margin-top: 16px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 6px 0; border-bottom: 1px solid #eee; text-align: left; }
          .box { border: 2px solid #000; padding: 12px; margin: 12px 0; }
          .warning-box { border: 1px solid #999; padding: 12px; background: #f9f9f9; }
          .no-print { margin-bottom: 1rem; }
        }
      `}</style>

      <div className="no-print">
        <PrintButton />
      </div>

      <h1>{project.name}</h1>
      <h2 style={{ borderBottom: "none", marginTop: "4pt" }}>JOB SITE SAFETY BINDER</h2>
      <p style={{ fontSize: "11pt", color: "#444" }}>
        Site: {siteAddress}<br />
        Generated: {generatedDate}<br />
        {superintendent && (
          <>Superintendent: {superintendent.employee.legalName} · {superintendent.employee.contact.phone ?? "no phone"}</>
        )}
      </p>

      {/* Emergency contacts */}
      <div className="box" style={{ marginTop: "24pt" }}>
        <h2 style={{ marginTop: 0, borderBottom: "none" }}>EMERGENCY CONTACTS</h2>
        <table>
          <tbody>
            <tr><td><strong>911</strong></td><td>All life-threatening emergencies</td></tr>
            <tr><td><strong>Poison Control</strong></td><td>1-800-222-1222</td></tr>
            <tr><td><strong>Nevada OSHA</strong></td><td>(775) 688-3045</td></tr>
            {project.nearestER && (
              <tr>
                <td><strong>Nearest ER</strong></td>
                <td>{project.nearestER}{project.nearestERAddress ? ` — ${project.nearestERAddress}` : ""}</td>
              </tr>
            )}
            {project.assemblyPoint && (
              <tr><td><strong>Assembly Point</strong></td><td>{project.assemblyPoint}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Phone tree */}
      <h2>TEAM PHONE TREE</h2>
      {project.teamMembers.length === 0 ? (
        <p>No team members assigned.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Role</th><th>Cell</th><th>Emergency Contact</th>
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

      {/* Site hazards */}
      {project.hazardNotes && (
        <>
          <h2>SITE-SPECIFIC HAZARDS</h2>
          <div className="warning-box">
            <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{project.hazardNotes}</p>
          </div>
        </>
      )}

      {/* SDS checklist */}
      <div className="page-break" />
      <h2>SDS (SAFETY DATA SHEET) CHECKLIST</h2>
      <p style={{ fontSize: "10pt" }}>
        The following hazardous materials are associated with this project. Confirm the SDS for each is in the site binder before work begins.
      </p>
      {uniqueHazardous.length === 0 ? (
        <p style={{ fontSize: "10pt", color: "#666" }}>
          No hazardous materials flagged in this project&apos;s quotes. If hazardous materials are in use, flag them in the Component Catalog.
        </p>
      ) : (
        <table>
          <thead>
            <tr><th>Material</th><th>SDS Available</th><th>Confirmed in Binder</th></tr>
          </thead>
          <tbody>
            {uniqueHazardous.map((m) => (
              <tr key={m.name}>
                <td>{m.name}</td>
                <td>{m.sdsUrl ? <a href={m.sdsUrl} target="_blank" rel="noopener noreferrer">View SDS</a> : "Upload needed"}</td>
                <td style={{ width: "120pt" }}>☐ Confirmed</td>
              </tr>
            ))}
            {unlinkedItems.map((desc, i) => (
              <tr key={`unlinked-${i}`} style={{ color: "#888" }}>
                <td>{desc} <em>(manual entry)</em></td>
                <td>Verify SDS manually</td>
                <td>☐ Confirmed</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Safety policy quick reference */}
      <div className="page-break" />
      <h2>SAFETY POLICY QUICK REFERENCE</h2>
      <h3>Fall Protection</h3>
      <ul>
        <li>Fall protection required for all work at 6 feet or higher above a lower level (OSHA 1926 Subpart M)</li>
        <li>Acceptable systems: guardrails, personal fall arrest systems (PFAS), safety nets</li>
        <li>Holes and floor openings must be covered and labeled</li>
      </ul>
      <h3>PPE — Minimum Required on All Sites</h3>
      <ul>
        <li>Hard hat (ANSI Z89.1 Class E)</li>
        <li>Safety glasses (ANSI Z87.1)</li>
        <li>Steel-toed boots</li>
      </ul>
      <h3>Heat Illness Prevention (Nevada NAC 618)</h3>
      <ul>
        <li>1 quart of cool water per worker per hour</li>
        <li>Shade required when temperature reaches 80°F</li>
        <li>10-minute cool-down rest available upon request — never denied</li>
        <li>Heat stroke (103°F+ body temp, no sweating, confusion): call 911 immediately</li>
      </ul>
      <h3>Incident Reporting</h3>
      <ul>
        <li>Report ALL incidents to superintendent immediately</li>
        <li>Fatality: report to OSHA within 8 hours</li>
        <li>Hospitalization / amputation / loss of eye: report to Nevada OSHA within 24 hours: (775) 688-3045</li>
        <li>Complete Incident Report Form within 24 hours (blank form on next page)</li>
      </ul>

      {/* Blank incident report form */}
      <div className="page-break" />
      <h2>INCIDENT REPORT FORM</h2>
      <p style={{ fontSize: "10pt", color: "#666" }}>Complete within 24 hours of any incident. Submit to superintendent.</p>
      <table style={{ marginTop: "12pt" }}>
        <tbody>
          {[
            "Date / Time of Incident:",
            "Location (address + specific area):",
            "Person(s) Involved (name, role):",
            "Witnesses (name, contact):",
            "Description of Incident:",
            "Immediate Cause:",
            "Contributing Factors:",
            "Injury / Illness (if any):",
            "Medical Treatment Required?",
            "Corrective Action Taken:",
            "Reported to Superintendent (name, date/time):",
            "Reported to OSHA? (if required):",
          ].map((field) => (
            <tr key={field} style={{ height: "32pt" }}>
              <td style={{ width: "200pt", verticalAlign: "top", fontWeight: "bold", fontSize: "10pt", paddingTop: "6pt" }}>{field}</td>
              <td style={{ borderBottom: "1px solid #000" }}></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: "10pt", marginTop: "12pt" }}>
        Superintendent Signature: _________________________ Date: _____________
      </p>
    </div>
  );
}
