import { TRADES } from "../../src/lib/trades";

export const EXTRACTION_MODEL = "claude-sonnet-4-6";

export const COMMERCIAL_PROJECT_TYPES = [
  "Office Buildout",
  "Medical Suite",
  "Warehouse / Industrial",
  "Suite Renovation",
  "Retail / Restaurant",
  "Light Maintenance / Repair",
] as const;

const TRADE_IDS = TRADES.map((t) => t.id);

export const EXTRACTION_SYSTEM_PROMPT = `You extract structured quote data from CPP-Painting & Construction proposal PDFs.

The proposals follow a Word-doc template:
- Header: customer name, job site address, proposal date
- Body: numbered or bulleted scope of work line items, each with a price
- Some proposals group items into sections; some are flat
- Footer area: subtotal, overhead %, profit %, total
- Followed by exclusions, disclaimers, and signature block

Some proposals include "Option:" or "Alternate:" lines that are conditional add-ons (e.g. "Option: If we are unable to lay LVT over existing — Remove existing LVT $1,800"). Tag these as alternates; they should NOT roll into the headline total.

Apply these rules:
1. Preserve numbers exactly as they appear in the PDF — never round, recompute, or guess.
2. For each line item, classify into one of these trade IDs: ${TRADE_IDS.join(", ")}.
3. For projectType, classify into one of: ${COMMERCIAL_PROJECT_TYPES.join(", ")}. Default to "Suite Renovation" if unclear.
4. For unit, use one of: ea, ls, sf, lf, hr. Default to "ls" (lump sum) when not specified.
5. Disclaimers are paragraphs that aren't line items, exclusions, or payment terms (e.g., kiln-dried wood notice, T&M repair rates).
6. Return overheadPct and profitPct as numbers from the PDF (e.g., if it says "8% Overhead", return 8). If the PDF doesn't show explicit OH/Profit lines, return 0 for both.
7. statedTotal is the headline total figure on the PDF — return it verbatim.

Do NOT invent line items. Do NOT add scope. Extract only what's printed.`;

export const EXTRACTION_TOOL_SCHEMA = {
  name: "record_proposal",
  description: "Record the structured proposal data extracted from the PDF.",
  input_schema: {
    type: "object" as const,
    required: ["customerCompany", "address", "proposalDate", "projectType", "overheadPct", "profitPct", "paymentTerms", "exclusions", "disclaimers", "lineItems", "statedTotal"],
    properties: {
      customerCompany: { type: "string" },
      address: { type: "string" },
      proposalDate: { type: "string", description: "ISO date YYYY-MM-DD" },
      projectType: { type: "string", enum: [...COMMERCIAL_PROJECT_TYPES] },
      overheadPct: { type: "number" },
      profitPct: { type: "number" },
      paymentTerms: { type: "string" },
      exclusions: { type: "string" },
      disclaimers: { type: "array", items: { type: "string" } },
      statedTotal: { type: "number" },
      lineItems: {
        type: "array",
        items: {
          type: "object",
          required: ["description", "quantity", "unit", "unitPrice", "tradeTag", "isAlternate"],
          properties: {
            description: { type: "string" },
            quantity: { type: "number" },
            unit: { type: "string", enum: ["ea", "ls", "sf", "lf", "hr"] },
            unitPrice: { type: "number" },
            tradeTag: { type: "string", enum: TRADE_IDS },
            isAlternate: { type: "boolean" },
          },
        },
      },
    },
  },
};
