import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const employees = await prisma.employee.findMany({
    include: {
      contact: { select: { firstName: true, lastName: true, email: true, phone: true } },
      certifications: true,
      onboardingSteps: { select: { stepName: true, completedAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(employees);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const {
    // Contact fields
    firstName, lastName, email, phone,
    // Employee fields
    legalName, hireDate, employmentType, tradeClassification,
    homeAddress, city, state, zip,
    ec1Name, ec1Relationship, ec1Phone,
    ec2Name, ec2Relationship, ec2Phone,
    driversLicenseNumber, driversLicenseExpiry,
  } = body;

  if (!firstName?.trim() || !email?.trim() || !legalName?.trim() ||
      !hireDate || !employmentType || !tradeClassification ||
      !homeAddress?.trim() || !city?.trim() || !state?.trim() || !zip?.trim() ||
      !ec1Name?.trim() || !ec1Relationship?.trim() || !ec1Phone?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const emailLower = email.trim().toLowerCase();

  // Upsert contact — employee may already exist in CRM
  const contact = await prisma.contact.upsert({
    where: { email: emailLower },
    update: { firstName: firstName.trim(), lastName: lastName?.trim() || null, phone: phone?.trim() || null, type: "employee" },
    create: { firstName: firstName.trim(), lastName: lastName?.trim() || null, email: emailLower, phone: phone?.trim() || null, type: "employee" },
  });

  // Check if Employee record already exists for this contact
  const existing = await prisma.employee.findUnique({ where: { contactId: contact.id } });
  if (existing) {
    return NextResponse.json({ error: "Employee record already exists for this contact" }, { status: 409 });
  }

  const employee = await prisma.employee.create({
    data: {
      contactId: contact.id,
      legalName: legalName.trim(),
      hireDate: new Date(hireDate),
      employmentType,
      tradeClassification,
      homeAddress: homeAddress.trim(),
      city: city.trim(),
      state: state.trim(),
      zip: zip.trim(),
      ec1Name: ec1Name.trim(),
      ec1Relationship: ec1Relationship.trim(),
      ec1Phone: ec1Phone.trim(),
      ec2Name: ec2Name?.trim() || null,
      ec2Relationship: ec2Relationship?.trim() || null,
      ec2Phone: ec2Phone?.trim() || null,
      driversLicenseNumber: driversLicenseNumber?.trim() || null,
      driversLicenseExpiry: driversLicenseExpiry ? new Date(driversLicenseExpiry) : null,
    },
    include: {
      contact: { select: { firstName: true, lastName: true, email: true, phone: true } },
    },
  });

  return NextResponse.json(employee, { status: 201 });
}
