import Anthropic from "@anthropic-ai/sdk";
import type { FloorPlanExtraction } from "./floor-plan-types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const EXTRACTION_PROMPT = `You are analyzing a scanned floor plan image. Extract the floor plan structure as JSON.

Rules:
1. Identify all walls as line segments. Use a normalized coordinate grid from 0 to 1000 for both x and y axes, where (0,0) is the top-left corner of the drawing.
2. Identify rooms as closed polygons. Include any handwritten room labels you can read (e.g., "Kitchen", "BR1", "Bath").
3. Extract dimensions — numbers written near walls indicating measurements in feet or inches.
4. Identify doors (breaks in walls, often with arc indicators) and windows (breaks in walls, often with parallel lines or cross-hatching).
5. If you cannot confidently identify something, add a description to the "notes" array rather than guessing.

The image may be a hand-drawn sketch on graph paper (primary use case) or a printed architect floor plan. Prioritize accuracy over completeness — it's better to miss a wall than to hallucinate one.

Return ONLY valid JSON with this structure:
{
  "walls": [{"x1": 0, "y1": 0, "x2": 500, "y2": 0}],
  "rooms": [{"label": "Kitchen", "points": [{"x": 0, "y": 0}, {"x": 500, "y": 0}, {"x": 500, "y": 300}, {"x": 0, "y": 300}]}],
  "dimensions": [{"wallIndex": 0, "length": 15, "unit": "ft"}],
  "openings": [{"wallIndex": 0, "position": 0.5, "type": "door", "width": 3}],
  "notes": ["Any observations about unclear areas"]
}

wallIndex references the 0-based index in the walls array.
position is a 0-1 value indicating where along the wall the opening is (0 = start, 1 = end).
width is in the same unit as the dimensions.`;

export async function extractFloorPlan(imageUrl: string): Promise<FloorPlanExtraction> {
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "url", url: imageUrl },
          },
          {
            type: "text",
            text: "Extract the floor plan structure from this scanned image.",
          },
        ],
      },
    ],
    system: EXTRACTION_PROMPT,
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  return parseExtractionResponse(text);
}

export function parseExtractionResponse(text: string): FloorPlanExtraction {
  const empty: FloorPlanExtraction = {
    walls: [],
    rooms: [],
    dimensions: [],
    openings: [],
    notes: [],
  };

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { ...empty, notes: [`Failed to parse extraction response: no JSON found in response`] };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      walls: Array.isArray(parsed.walls) ? parsed.walls : [],
      rooms: Array.isArray(parsed.rooms) ? parsed.rooms : [],
      dimensions: Array.isArray(parsed.dimensions) ? parsed.dimensions : [],
      openings: Array.isArray(parsed.openings) ? parsed.openings : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
    };
  } catch {
    return { ...empty, notes: [`Failed to parse extraction response: invalid JSON`] };
  }
}
