import jsPDF from "jspdf";

export function buildTitleBlock(
  floorPlanName: string,
  projectName: string | null,
  date: Date
): string[] {
  const formatted = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const lines: string[] = [floorPlanName];
  if (projectName) lines.push(projectName);
  lines.push("CPP Painting & Construction LLC");
  lines.push(formatted);
  return lines;
}

export function exportToPdf(
  canvasDataUrl: string,
  canvasWidth: number,
  canvasHeight: number,
  floorPlanName: string,
  projectName: string | null
): jsPDF {
  const pdf = new jsPDF({
    orientation: canvasWidth > canvasHeight ? "landscape" : "portrait",
    unit: "pt",
    format: "letter",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 40;
  const titleBlockHeight = 60;

  const lines = buildTitleBlock(floorPlanName, projectName, new Date());
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text(lines[0], margin, margin + 14);

  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  for (let i = 1; i < lines.length; i++) {
    pdf.text(lines[i], margin, margin + 14 + i * 14);
  }

  const ruleY = margin + titleBlockHeight;
  pdf.setDrawColor(180);
  pdf.setLineWidth(0.5);
  pdf.line(margin, ruleY, pageWidth - margin, ruleY);

  const availableWidth = pageWidth - margin * 2;
  const availableHeight = pageHeight - ruleY - margin - 10;
  const scale = Math.min(availableWidth / canvasWidth, availableHeight / canvasHeight);
  const imgWidth = canvasWidth * scale;
  const imgHeight = canvasHeight * scale;
  const imgX = margin + (availableWidth - imgWidth) / 2;
  const imgY = ruleY + 10;

  pdf.addImage(canvasDataUrl, "PNG", imgX, imgY, imgWidth, imgHeight);

  return pdf;
}
