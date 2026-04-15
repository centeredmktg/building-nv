import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const phone = (formData.get("phone") as string)?.trim() || null;
  const jobPostingId = formData.get("jobPostingId") as string;
  const resume = formData.get("resume") as File | null;

  if (!name || !email || !jobPostingId) {
    return NextResponse.json({ error: "Name, email, and job posting are required" }, { status: 400 });
  }

  if (!resume) {
    return NextResponse.json({ error: "Resume file is required" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(resume.type)) {
    return NextResponse.json({ error: "Only PDF and Word documents are accepted" }, { status: 400 });
  }

  if (resume.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  // Verify posting exists and is open
  const posting = await prisma.jobPosting.findUnique({
    where: { id: jobPostingId },
    select: { status: true },
  });

  if (!posting || posting.status !== "open") {
    return NextResponse.json({ error: "This position is no longer accepting applications" }, { status: 400 });
  }

  // Upload resume to Vercel Blob
  const blob = await put(`resumes/${Date.now()}-${resume.name}`, resume, {
    access: "public",
  });

  // Create application record
  await prisma.jobApplication.create({
    data: {
      jobPostingId,
      name,
      email,
      phone,
      resumeUrl: blob.url,
    },
  });

  return NextResponse.json({ success: true }, { status: 201 });
}
