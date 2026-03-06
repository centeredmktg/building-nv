import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

export interface QuoteGenerationResult {
  sections: GeneratedSection[];
  questions: string[];
}

const SYSTEM_PROMPT = `You are an expert construction estimator for Building NV, a commercial tenant improvement (TI) contractor based in Reno, Nevada.

Your job is to parse a scope of work and generate a detailed, priced quote with line items organized into sections.

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
- Scissor lift rental: $150/day delivery + $125/day rental

Output rules:
1. If you have enough information to price ALL items, return JSON with sections and empty questions array.
2. If you are MISSING specific data needed to price an item accurately (square footage, fixture count, etc.), return the questions array with 1-3 specific questions. Do NOT guess.
3. Organize line items into logical sections: by unit, by trade, or by space type.
4. Materials (supply-only items) should have isMaterial: true.
5. Combined supply+install items are isMaterial: false (labor-dominant).
6. Keep descriptions tight and professional — match the style: "Remove 10 ea. fluorescent lights and install LED lights per code"

Return ONLY valid JSON in this exact format:
{
  "sections": [
    {
      "title": "Unit 1 - Office",
      "items": [
        {
          "description": "Remove and replace fluorescent lights with LED per code",
          "quantity": 10,
          "unit": "ea",
          "unitPrice": 190,
          "isMaterial": false
        }
      ]
    }
  ],
  "questions": []
}`;

export async function generateQuoteFromScope(
  scopeText: string
): Promise<QuoteGenerationResult> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `Please generate a quote for the following scope of work:\n\n${scopeText}`,
      },
    ],
    system: SYSTEM_PROMPT,
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Claude did not return valid JSON");
  }

  return JSON.parse(jsonMatch[0]) as QuoteGenerationResult;
}
