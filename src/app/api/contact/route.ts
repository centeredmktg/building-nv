import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractBusinessDomain, splitName } from "@/lib/crm";
import { Resend } from "resend";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, company: companyName, phone, projectType, message } = body as {
    name?: string;
    email?: string;
    company?: string;
    phone?: string;
    projectType?: string;
    message?: string;
  };

  const fullName = name?.trim() ?? "";
  const emailLower = email?.trim().toLowerCase() ?? "";
  const phoneTrimmed = phone?.trim() ?? "";

  if (!fullName || !emailLower || !phoneTrimmed) {
    return NextResponse.json({ error: "Name, email, and phone are required" }, { status: 400 });
  }

  const { first, last } = splitName(fullName);
  const domain = extractBusinessDomain(emailLower);

  // Upsert company (only if business domain detected)
  let companyId: string | null = null;
  if (domain) {
    const company = await prisma.company.upsert({
      where: { domain },
      update: { name: companyName || domain },
      create: { name: companyName || domain, type: "customer", domain },
    });
    companyId = company.id;
  }

  // Upsert contact by email
  const contact = await prisma.contact.upsert({
    where: { email: emailLower },
    update: { firstName: first, lastName: last, phone: phoneTrimmed || null, primaryCompanyId: companyId },
    create: {
      firstName: first,
      lastName: last,
      email: emailLower,
      phone: phoneTrimmed || null,
      type: "customer",
      primaryCompanyId: companyId,
    },
  });

  // Create project
  const projectLabel = companyName?.trim()
    ? `${projectType ?? "Project"} — ${companyName.trim()}`
    : `${projectType ?? "Project"} — ${fullName}`;

  const project = await prisma.project.create({
    data: {
      name: projectLabel,
      stage: "opportunity_identified",
      projectType: projectType ?? null,
      message: message ?? null,
      projectContacts: {
        create: { contactId: contact.id, role: "customer" },
      },
      ...(companyId
        ? { projectCompanies: { create: { companyId, role: "customer" } } }
        : {}),
    },
  });

  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.RESEND_FROM ?? "Building NV <noreply@buildingnv.com>",
      to: process.env.RESEND_TO ?? "bids@buildingnv.com",
      subject: `New Inquiry: ${fullName} — ${projectType ?? "General"}`,
      text: [
        `Name: ${fullName}`,
        `Email: ${emailLower}`,
        `Company: ${companyName?.trim() || "—"}`,
        `Phone: ${phoneTrimmed}`,
        `Project Type: ${projectType ?? "—"}`,
        `Message: ${message ?? "—"}`,
        ``,
        `View in pipeline: https://buildingnv.us/internal/projects`,
      ].join("\n"),
    });
  }

  return NextResponse.json({ success: true });
}
