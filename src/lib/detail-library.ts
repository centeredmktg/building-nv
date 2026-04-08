export const DETAIL_TYPES = [
  { id: "installation", label: "Installation" },
  { id: "assembly", label: "Assembly" },
  { id: "connection", label: "Connection" },
  { id: "flashing", label: "Flashing" },
  { id: "waterproofing", label: "Waterproofing" },
  { id: "structural", label: "Structural" },
  { id: "general", label: "General" },
] as const;

export type DetailTypeId = (typeof DETAIL_TYPES)[number]["id"];

export function getDetailTypeLabel(id: DetailTypeId): string {
  return DETAIL_TYPES.find((t) => t.id === id)?.label ?? id;
}

export const CSI_DIVISIONS = [
  { code: "03", title: "Concrete" },
  { code: "04", title: "Masonry" },
  { code: "05", title: "Metals" },
  { code: "06", title: "Wood, Plastics, and Composites" },
  { code: "07", title: "Thermal and Moisture Protection" },
  { code: "08", title: "Openings" },
  { code: "09", title: "Finishes" },
  { code: "22", title: "Plumbing" },
  { code: "23", title: "HVAC" },
  { code: "26", title: "Electrical" },
  { code: "31", title: "Earthwork" },
] as const;

export type CsiDivisionCode = (typeof CSI_DIVISIONS)[number]["code"];

export function getCsiTitle(code: string): string | null {
  return CSI_DIVISIONS.find((d) => d.code === code)?.title ?? null;
}
