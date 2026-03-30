import Anthropic from "@anthropic-ai/sdk";
import type { ComplianceRule, ChatResponse, VectorChunk } from "./types";
import { getAllRules, getKeywordIndex, getAllReferenceDocs } from "./corpus-loader";
import { VectorStore, chunkText, generateEmbeddings } from "./vector-search";

const SYSTEM_PROMPT = `You are a compliance reference assistant for CPP Painting & Construction LLC, a Nevada general contractor (license #0092515, bid limit $1,400,000).

Answer ONLY from the provided reference material. If the answer is not in the provided context, say "I don't have a reference for that — check with your compliance officer or the relevant agency directly."

Never improvise compliance advice. Always cite the specific statute, code section, or standard. Format citations in parentheses after the relevant statement.

Keep answers concise and actionable. If a rule has a specific action item, state it clearly.`;

let vectorStore: VectorStore | null = null;
let vectorStoreInitialized = false;

async function ensureVectorStore(): Promise<VectorStore> {
  if (vectorStoreInitialized && vectorStore) return vectorStore;

  vectorStore = new VectorStore();

  const rules = getAllRules();
  const refs = getAllReferenceDocs();

  const allTexts: { sourceId: string; sourceType: "rule" | "reference"; text: string }[] = [];

  for (const rule of rules) {
    const fullText = `${rule.title}\n${rule.citation}\n${rule.body}`;
    const chunks = chunkText(fullText);
    for (const chunk of chunks) {
      allTexts.push({ sourceId: rule.id, sourceType: "rule", text: chunk });
    }
  }

  for (const ref of refs) {
    const chunks = chunkText(ref.body);
    for (const chunk of chunks) {
      allTexts.push({ sourceId: ref.id, sourceType: "reference", text: chunk });
    }
  }

  const embeddings = await generateEmbeddings(allTexts.map((t) => t.text));

  for (let i = 0; i < allTexts.length; i++) {
    vectorStore.add({
      id: `${allTexts[i].sourceId}-${i}`,
      sourceId: allTexts[i].sourceId,
      sourceType: allTexts[i].sourceType,
      text: allTexts[i].text,
      embedding: embeddings[i],
    });
  }

  vectorStoreInitialized = true;
  return vectorStore;
}

export function findDirectRuleMatch(
  message: string,
  rules: ComplianceRule[],
  keywordIndex: Map<string, string[]>
): ComplianceRule | null {
  const lower = message.toLowerCase();
  const matchedRuleIds = new Set<string>();

  for (const [keyword, ruleIds] of keywordIndex) {
    if (lower.includes(keyword)) {
      for (const id of ruleIds) matchedRuleIds.add(id);
    }
  }

  if (matchedRuleIds.size === 0) return null;

  const severityOrder: Record<string, number> = { BLOCK: 3, WARNING: 2, INFO: 1 };
  let best: ComplianceRule | null = null;
  let bestSeverity = 0;

  for (const id of matchedRuleIds) {
    const rule = rules.find((r) => r.id === id);
    if (rule) {
      const sev = severityOrder[rule.severity] ?? 0;
      if (sev > bestSeverity) {
        best = rule;
        bestSeverity = sev;
      }
    }
  }

  return best;
}

export function buildChatContext(
  directMatch: ComplianceRule | null,
  vectorResults: VectorChunk[]
): string {
  const parts: string[] = [];

  if (directMatch) {
    parts.push(`## Direct Rule Match\n**${directMatch.title}** (${directMatch.citation})\nSeverity: ${directMatch.severity}\nAction: ${directMatch.action}\n\n${directMatch.body}`);
  }

  if (vectorResults.length > 0) {
    parts.push("## Additional Reference Material");
    for (const chunk of vectorResults) {
      parts.push(`---\nSource: ${chunk.sourceId}\n${chunk.text}`);
    }
  }

  return parts.join("\n\n");
}

export async function chat(
  message: string,
  conversationHistory: { role: "user" | "assistant"; content: string }[] = [],
  projectContext?: { projectType?: string; scopeDescription?: string }
): Promise<ChatResponse> {
  const rules = getAllRules();
  const kwIndex = getKeywordIndex();

  const directMatch = findDirectRuleMatch(message, rules, kwIndex);

  const store = await ensureVectorStore();
  const queryEmbedding = (await generateEmbeddings([message]))[0];
  const vectorResults = store.search(queryEmbedding, 5);

  const filteredResults = directMatch
    ? vectorResults.filter((r) => r.sourceId !== directMatch.id)
    : vectorResults;

  const context = buildChatContext(directMatch, filteredResults.slice(0, 3));

  let systemPrompt = SYSTEM_PROMPT;
  if (projectContext) {
    systemPrompt += `\n\nProject context: Type: ${projectContext.projectType ?? "unknown"}. ${projectContext.scopeDescription ?? ""}`;
  }

  const messages: Anthropic.MessageParam[] = [
    ...conversationHistory.slice(-10).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    {
      role: "user" as const,
      content: `Reference material:\n\n${context}\n\n---\n\nUser question: ${message}`,
    },
  ];

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  const reply = response.content[0].type === "text" ? response.content[0].text : "";

  const citations: ChatResponse["citations"] = [];
  if (directMatch) {
    citations.push({
      ruleId: directMatch.id,
      citation: directMatch.citation,
      title: directMatch.title,
    });
  }
  const seenIds = new Set(citations.map((c) => c.ruleId));
  for (const chunk of filteredResults.slice(0, 3)) {
    if (chunk.sourceType === "rule" && !seenIds.has(chunk.sourceId)) {
      const rule = rules.find((r) => r.id === chunk.sourceId);
      if (rule) {
        citations.push({ ruleId: rule.id, citation: rule.citation, title: rule.title });
        seenIds.add(rule.id);
      }
    }
  }

  return { reply, citations, severity: directMatch?.severity };
}
