interface MilestoneTemplate {
  name: string;
  position: number;
}

const COMMERCIAL_TYPES = [
  "Office Buildout",
  "Medical Suite",
  "Warehouse / Industrial",
  "Suite Renovation",
  "Retail / Restaurant",
  "Retail & Restaurant",
  "Light Maintenance / Repair",
];

const KITCHEN_BATH_TYPES = ["Kitchen Remodel", "Bathroom Renovation"];

const OFFICE_BUILDOUT_TEMPLATE = [
  "Preconstruction",
  "Demo",
  "Rough-In (MEP)",
  "Inspections",
  "Drywall & Finish",
  "Punch List",
  "Final Walkthrough",
];

const KITCHEN_BATH_TEMPLATE = [
  "Preconstruction",
  "Demo",
  "Rough-In",
  "Tile & Fixtures",
  "Finish Carpentry",
  "Punch List",
  "Final Walkthrough",
];

const CUSTOM_RESIDENTIAL_TEMPLATE = [
  "Preconstruction",
  "Foundation",
  "Framing",
  "MEP Rough",
  "Insulation & Drywall",
  "Finish Work",
  "Landscaping",
  "Punch List",
  "Final Walkthrough",
];

const DEFAULT_TEMPLATE = [
  "Preconstruction",
  "Active Work",
  "Punch List",
  "Final Walkthrough",
];

export function getMilestoneTemplates(projectType: string | null): MilestoneTemplate[] {
  let names: string[];

  if (projectType === "Custom Residential Build") {
    names = CUSTOM_RESIDENTIAL_TEMPLATE;
  } else if (projectType && KITCHEN_BATH_TYPES.includes(projectType)) {
    names = KITCHEN_BATH_TEMPLATE;
  } else if (projectType && COMMERCIAL_TYPES.includes(projectType)) {
    names = OFFICE_BUILDOUT_TEMPLATE;
  } else {
    names = DEFAULT_TEMPLATE;
  }

  return names.map((name, position) => ({ name, position }));
}
