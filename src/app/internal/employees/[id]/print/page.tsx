import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatEmployeeName } from "@/lib/employees";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

export default async function EmployeeProfilePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      contact: true,
      certifications: { orderBy: { issueDate: "desc" } },
    },
  });

  if (!employee) notFound();

  const name = formatEmployeeName({
    legalName: employee.legalName,
    firstName: employee.contact.firstName,
    lastName: employee.contact.lastName,
  });

  const generatedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div style={{ maxWidth: "700px", margin: "2rem auto", padding: "2rem", fontFamily: "Arial, sans-serif", fontSize: "12px" }}>
      <style>{`
        @media print {
          body { margin: 0; font-family: Arial, sans-serif; font-size: 11pt; }
          div { max-width: none !important; margin: 0 !important; padding: 0.75in !important; }
          .no-print { display: none !important; }
          table { width: 100%; border-collapse: collapse; }
          td { padding: 4pt 8pt 4pt 0; vertical-align: top; }
          .label { color: #666; width: 160pt; }
          h2 { font-size: 12pt; border-bottom: 1px solid #000; padding-bottom: 4pt; margin-top: 16pt; }
        }
        @media screen {
          table { width: 100%; border-collapse: collapse; }
          td { padding: 5px 10px 5px 0; vertical-align: top; }
          .label { color: #666; width: 160px; }
          h2 { border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 20px; }
          .no-print { margin-bottom: 1rem; }
        }
      `}</style>

      <div className="no-print">
        <PrintButton />
      </div>

      <h1 style={{ fontSize: "18px", marginBottom: "2px" }}>{name}</h1>
      <p style={{ color: "#666", marginBottom: "16px", fontSize: "11px" }}>
        Employee Profile · Generated {generatedDate}
      </p>

      <h2>Employment</h2>
      <table>
        <tbody>
          <tr><td className="label">Trade</td><td style={{ textTransform: "capitalize" }}>{employee.tradeClassification}</td></tr>
          <tr><td className="label">Type</td><td>{employee.employmentType === "W2" ? "W-2 Employee" : "1099 Contractor"}</td></tr>
          <tr><td className="label">Status</td><td style={{ textTransform: "capitalize" }}>{employee.activeStatus}</td></tr>
          <tr><td className="label">Hire Date</td><td>{employee.hireDate.toLocaleDateString()}</td></tr>
          <tr><td className="label">Email</td><td>{employee.contact.email ?? "—"}</td></tr>
          <tr><td className="label">Phone</td><td>{employee.contact.phone ?? "—"}</td></tr>
        </tbody>
      </table>

      <h2>Address</h2>
      <p style={{ margin: "4px 0" }}>
        {employee.homeAddress}<br />
        {employee.city}, {employee.state} {employee.zip}
      </p>

      <h2>Emergency Contacts</h2>
      <table>
        <tbody>
          <tr>
            <td className="label">Primary</td>
            <td>{employee.ec1Name} ({employee.ec1Relationship}) · {employee.ec1Phone}</td>
          </tr>
          {employee.ec2Name && (
            <tr>
              <td className="label">Secondary</td>
              <td>{employee.ec2Name} ({employee.ec2Relationship}) · {employee.ec2Phone}</td>
            </tr>
          )}
        </tbody>
      </table>

      {employee.certifications.length > 0 && (
        <>
          <h2>Certifications</h2>
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #000", padding: "4px 0" }}>Type</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #000", padding: "4px 0" }}>Issued</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #000", padding: "4px 0" }}>Expires</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #000", padding: "4px 0" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {employee.certifications.map((c) => (
                <tr key={c.id}>
                  <td>{c.type.replace("_", " ")}</td>
                  <td>{c.issueDate.toLocaleDateString()}</td>
                  <td>{c.expirationDate?.toLocaleDateString() ?? "No Expiry"}</td>
                  <td style={{ textTransform: "capitalize" }}>{c.verifiedStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <p style={{ marginTop: "32px", fontSize: "10px", color: "#999" }}>
        Confidential — For authorized use only. Retain in employee personnel file.
      </p>
    </div>
  );
}
