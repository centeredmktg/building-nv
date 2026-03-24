import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { email, name } = await req.json() as { email: string; name?: string };

  if (!email?.trim()) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const emailLower = email.trim().toLowerCase();

  // Expire in 7 days
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const invite = await prisma.onboardingInvite.create({
    data: { email: emailLower, expiresAt },
  });

  // Send invite email via Resend if configured
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const onboardingUrl = `${process.env.NEXTAUTH_URL}/onboarding/${invite.token}`;

    await resend.emails.send({
      from: "Building NV <noreply@buildingnv.com>",
      to: emailLower,
      subject: "Complete Your Onboarding — Building NV",
      text: [
        name ? `Hi ${name},` : "Hi,",
        "",
        "You've been invited to complete your onboarding with Building NV.",
        "Click the link below to get started:",
        "",
        onboardingUrl,
        "",
        "This link expires in 7 days.",
        "",
        "If you have questions, contact your supervisor.",
      ].join("\n"),
    });
  }

  return NextResponse.json({ id: invite.id, token: invite.token }, { status: 201 });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const invites = await prisma.onboardingInvite.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(invites);
}
