import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Shared types ──────────────────────────────────────────────────────────────

export interface GeneratedLineItem {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  isMaterial: boolean;
}

export interface GeneratedSection {
  title: string;
  items: GeneratedLineItem[];
}

// ─── Legacy type (kept for backwards compat) ───────────────────────────────────

export interface QuoteGenerationResult {
  sections: GeneratedSection[];
  questions: string[];
}

// ─── Streaming types ───────────────────────────────────────────────────────────

export type StreamEvent =
  | { type: "extracted"; contactName?: string; address?: string; projectType?: string; gaps: string[] }
  | { type: "section"; data: GeneratedSection }
  | { type: "done" };

// ─── Prompts ───────────────────────────────────────────────────────────────────

const BASE_CONTEXT = `You are an expert construction estimator for Building NV, a commercial tenant improvement (TI) contractor based in Reno, Nevada.

Reno NV market context:
- Labor rates: General labor $65-85/hr, Skilled trades $85-120/hr, Electrician $95-130/hr
- LED light swap (supply + install): $140-190 per fixture
- Ceiling tile replacement: $3.50-4.50/SF installed
- LVT flooring: $6-8/SF installed (includes material + labor)
- Cove base: $3-5/LF installed
- Insulation (batts, per piece): $35-50 each
- Drywall: $4-6/SF installed
- Paint: $1.50-2.50/SF (walls), $1-1.50/SF (ceiling)
- Dump fees: $500-1000 per job depending on volume
- Scissor lift rental: $150/day delivery + $125/day rental`;

const STREAM_SYSTEM_PROMPT = `${BASE_CONTEXT}

Your job is to parse a scope of work (which may be a voice transcript, an RFP, typed notes, or contractor shorthand) and output structured data as newline-delimited JSON (NDJSON). Parse intent, not grammar — voice transcripts will have incomplete sentences and measurements embedded in prose.

Output rules:
1. First line: an "extracted" event with whatever you can identify from the input (contact name, job site address, project type) and a "gaps" array listing required fields you could NOT extract. Use these gap key names: "contact_name", "address", "project_type".
2. Then output one "section" event per section of the quote.
3. Final line: a "done" event.
4. Each line must be valid JSON. No markdown, no code blocks, no prose — only NDJSON.
5. Materials (supply-only items) have isMaterial: true. Combined supply+install are isMaterial: false.
6. Keep descriptions tight: "Remove 10 ea. fluorescent lights and install LED lights per code"
7. If you genuinely cannot produce even one line item (e.g., input is gibberish), output a single section with a placeholder item and note the gap.

Example output (3 lines total):
{"type":"extracted","contactName":"John Smith","address":"123 Main St, Reno NV","projectType":"Office Buildout","gaps":[]}
{"type":"section","data":{"title":"Demolition","items":[{"description":"Demo existing partition walls","quantity":1,"unit":"ls","unitPrice":2800,"isMaterial":false}]}}
{"type":"done"}`;

// ─── Streaming generator ────────────────────────────────────────────────────────

/**
 * Streams quote generation as NDJSON events.
 * Yields StreamEvent objects as Claude produces them.
 * Use in a Next.js streaming route handler.
 */
export async function* generateQuoteStream(
  scopeText: string
): AsyncGenerator<StreamEvent> {
  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: STREAM_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Parse and price this scope of work:\n\n${scopeText}`,
      },
    ],
  });

  let buffer = "";

  for await (const chunk of stream) {
    if (
      chunk.type === "content_block_delta" &&
      chunk.delta.type === "text_delta"
    ) {
      buffer += chunk.delta.text;
      const lines = buffer.split("\n");
      // All complete lines (everything except the last partial line)
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        try {
          yield JSON.parse(line) as StreamEvent;
        } catch {
          // Malformed line — skip
        }
      }
      buffer = lines[lines.length - 1]; // keep the partial last line
    }
  }

  // Flush any remaining buffered content
  if (buffer.trim()) {
    try {
      yield JSON.parse(buffer.trim()) as StreamEvent;
    } catch {
      // ignore
    }
  }
}

// ─── Legacy non-streaming function (kept for existing tests) ───────────────────

const LEGACY_SYSTEM_PROMPT = `${BASE_CONTEXT}

Output rules:
1. If you have enough information to price ALL items, return JSON with sections and empty questions array.
2. If you are MISSING specific data needed to price an item accurately, return the questions array with 1-3 specific questions. Do NOT guess.
3. Organize line items into logical sections.
4. Materials (supply-only items) should have isMaterial: true.
5. Combined supply+install items are isMaterial: false.
6. Keep descriptions tight and professional.

Return ONLY valid JSON:
{
  "sections": [{"title": "...", "items": [{"description": "...", "quantity": 1, "unit": "ls", "unitPrice": 2800, "isMaterial": false}]}],
  "questions": []
}`;

export async function generateQuoteFromScope(
  scopeText: string
): Promise<QuoteGenerationResult> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [{ role: "user", content: `Please generate a quote for the following scope of work:\n\n${scopeText}` }],
    system: LEGACY_SYSTEM_PROMPT,
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude did not return valid JSON");
  return JSON.parse(jsonMatch[0]) as QuoteGenerationResult;
}
