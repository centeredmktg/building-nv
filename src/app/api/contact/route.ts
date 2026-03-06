import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, company, phone, projectType, message } = body;

  if (!name || !phone) {
    return NextResponse.json({ error: "Name and phone are required" }, { status: 400 });
  }

  // Log submission (replace with email service later, e.g. Resend)
  console.log("Contact form submission:", { name, company, phone, projectType, message });

  return NextResponse.json({ success: true });
}
