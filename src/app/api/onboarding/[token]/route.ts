import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: validate token and return invite + partial employee data if contact exists
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const invite = await prisma.onboardingInvite.findUnique({ where: { token } });

  if (!invite) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  if (invite.status === "completed") return NextResponse.json({ error: "This onboarding link has already been completed" }, { status: 410 });
  if (invite.expiresAt < new Date()) {
    await prisma.onboardingInvite.update({ where: { token }, data: { status: "expired" } });
    return NextResponse.json({ error: "This onboarding link has expired" }, { status: 410 });
  }

  // If a contact is already linked, return their employee + step data
  let employee = null;
  if (invite.contactId) {
    const contact = await prisma.contact.findUnique({
      where: { id: invite.contactId },
      include: {
        employee: {
          include: {
            onboardingSteps: true,
            certifications: { select: { type: true, verifiedStatus: true } },
          },
        },
      },
    });
    employee = contact?.employee ?? null;
  }

  return NextResponse.json({ invite, employee });
}

// PATCH: complete a step
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await req.json() as {
    stepName: string;
    stepData?: Record<string, unknown>;
    signerName?: string;
  };

  const invite = await prisma.onboardingInvite.findUnique({ where: { token } });
  if (!invite || invite.status !== "pending" || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 410 });
  }

  const { stepName, stepData, signerName } = body;

  // Step 1 (personal_info): create Contact + Employee
  if (stepName === "personal_info") {
    if (!stepData) return NextResponse.json({ error: "stepData required for personal_info" }, { status: 400 });

    const {
      firstName, lastName, legalName, phone,
      employmentType, tradeClassification,
      homeAddress, city, state, zip,
    } = stepData as Record<string, string>;

    // Create/upsert Contact
    const contact = await prisma.contact.upsert({
      where: { email: invite.email },
      update: { firstName, lastName: lastName || null, phone: phone || null, type: "employee" },
      create: { firstName, lastName: lastName || null, email: invite.email, phone: phone || null, type: "employee" },
    });

    // Create Employee if not exists
    let employee = await prisma.employee.findUnique({ where: { contactId: contact.id } });
    if (!employee) {
      employee = await prisma.employee.create({
        data: {
          contactId: contact.id,
          legalName,
          hireDate: new Date(),
          employmentType,
          tradeClassification,
          homeAddress,
          city,
          state,
          zip,
          // EC fields will be filled in Step 2
          ec1Name: "",
          ec1Relationship: "",
          ec1Phone: "",
        },
      });
    }

    // Link contactId to invite
    await prisma.onboardingInvite.update({
      where: { token },
      data: { contactId: contact.id },
    });

    // Record step completion
    await prisma.onboardingStep.upsert({
      where: { employeeId_stepName: { employeeId: employee.id, stepName: "personal_info" } },
      update: { completedAt: new Date() },
      create: { employeeId: employee.id, stepName: "personal_info", completedAt: new Date() },
    });

    return NextResponse.json({ success: true, employeeId: employee.id });
  }

  // All other steps require an existing Employee record
  if (!invite.contactId) {
    return NextResponse.json({ error: "Complete personal info first" }, { status: 400 });
  }

  const contact = await prisma.contact.findUnique({ where: { id: invite.contactId } });
  const employee = contact
    ? await prisma.employee.findUnique({ where: { contactId: contact.id } })
    : null;

  if (!employee) return NextResponse.json({ error: "Employee record not found" }, { status: 404 });

  // Step 2 (emergency_contacts): update EC fields
  if (stepName === "emergency_contacts" && stepData) {
    const { ec1Name, ec1Relationship, ec1Phone, ec2Name, ec2Relationship, ec2Phone } =
      stepData as Record<string, string>;

    if (!ec1Name || !ec1Relationship || !ec1Phone) {
      return NextResponse.json({ error: "Emergency contact 1 is required" }, { status: 400 });
    }

    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        ec1Name, ec1Relationship, ec1Phone,
        ec2Name: ec2Name || null,
        ec2Relationship: ec2Relationship || null,
        ec2Phone: ec2Phone || null,
      },
    });
  }

  // Steps 6 + 7 require a signerName (e-signature)
  if ((stepName === "safety_manual_ack" || stepName === "workbook_ack") && !signerName) {
    return NextResponse.json({ error: "Signature required" }, { status: 400 });
  }

  // Mark step complete
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? null;
  await prisma.onboardingStep.upsert({
    where: { employeeId_stepName: { employeeId: employee.id, stepName } },
    update: { completedAt: new Date(), signerName: signerName ?? null, ipAddress: ip },
    create: {
      employeeId: employee.id,
      stepName,
      completedAt: new Date(),
      signerName: signerName ?? null,
      ipAddress: ip,
    },
  });

  // If this is the final step, mark invite as completed
  if (stepName === "complete") {
    await prisma.onboardingInvite.update({ where: { token }, data: { status: "completed" } });
  }

  return NextResponse.json({ success: true });
}
