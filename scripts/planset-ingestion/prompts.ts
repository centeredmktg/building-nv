export const SHEET_CLASSIFIER_PROMPT = `You are analyzing a single page from a residential construction plan set.

Classify this sheet and extract its metadata.

Return ONLY valid JSON (no markdown, no explanation):
{
  "sheetNumber": "string — the sheet number shown on the page (e.g., 'SP-1', 'A-3', 'E-1', 'ID-06')",
  "sheetType": "site_plan | trpa_coverage | defensible_space | bmp | demo_plan | proposed_plan | elevation | keynotes | electrical | structural | interior_design | detail | unknown",
  "title": "string — the sheet title (e.g., 'LOWER LEVEL DEMO', 'UPPER LEVEL PROPOSED')"
}`;

export const SCOPE_EXTRACTION_PROMPT = `You are a construction estimator analyzing a page from a residential plan set.

Extract ALL scope items visible on this sheet as structured line items for a construction bid.

For each item, determine:
- description: What needs to be built/installed/removed (be specific)
- quantity: Numeric quantity (measure from dimensions shown, count fixtures, estimate SF from room dimensions)
- unit: SF, LF, EA, LS, HR, CY, or SY
- isMaterial: true if this is a material/product, false if it's labor/installation
- trade: Which construction trade handles this (use: general_labor, carpentry, electrical, plumbing, hvac, painting, concrete, roofing, flooring, drywall, insulation, demolition, excavation, landscaping, fire_protection, low_voltage, glazing, masonry, welding, other)

Return ONLY valid JSON (no markdown, no explanation):
{
  "items": [
    {
      "description": "string",
      "quantity": number,
      "unit": "SF|LF|EA|LS|HR|CY|SY",
      "isMaterial": boolean,
      "trade": "string",
      "notes": "string — any relevant details, dimensions, specifications"
    }
  ]
}

Be thorough. Extract every discrete scope item. If you can calculate SF from room dimensions shown, do so. Count every fixture, outlet, switch, etc.`;

export const PRICING_PROMPT = `You are a construction cost estimator for the Lake Tahoe / Incline Village, NV market.

Given these scope items from a residential remodel, provide unit pricing estimates.

Lake Tahoe / mountain construction rates are typically 20-40% above Reno metro rates.

For each item, provide:
- unitPrice: customer-facing price per unit (includes typical GC markup)
- vendorCost: estimated cost to the GC (sub cost or material cost before markup)

Return ONLY valid JSON (no markdown):
{
  "items": [
    {
      "description": "string (from input)",
      "unitPrice": number,
      "vendorCost": number
    }
  ]
}`;
