import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { chat } from "@/lib/compliance/chatbot";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { message, sessionId, projectId } = body;

  if (!message || !sessionId) {
    return NextResponse.json(
      { error: "message and sessionId are required" },
      { status: 400 }
    );
  }

  // Load conversation history
  const history = await prisma.complianceChatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: { role: true, content: true },
  });

  // Load project context if provided
  let projectContext: { projectType?: string; scopeDescription?: string } | undefined;
  if (projectId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { projectType: true, notes: true },
    });
    if (project) {
      projectContext = {
        projectType: project.projectType ?? undefined,
        scopeDescription: project.notes ?? undefined,
      };
    }
  }

  // Save user message
  await prisma.complianceChatMessage.create({
    data: {
      sessionId,
      projectId: projectId ?? null,
      role: "user",
      content: message,
    },
  });

  // Run the RAG pipeline
  const response = await chat(
    message,
    history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
    projectContext
  );

  // Save assistant response
  await prisma.complianceChatMessage.create({
    data: {
      sessionId,
      projectId: projectId ?? null,
      role: "assistant",
      content: response.reply,
      citations: response.citations,
    },
  });

  return NextResponse.json(response);
}
