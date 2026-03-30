import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Based on CPP Painting & Construction LLC license #0092515
// General contractor — can do general labor, carpentry, painting, drywall, demolition
// Cannot do: electrical, plumbing, HVAC, roofing, fire protection, low voltage (require specialty licenses)
const capabilities = [
  { trade: "general_labor", canPerform: true },
  { trade: "carpentry", canPerform: true },
  { trade: "electrical", canPerform: false },
  { trade: "plumbing", canPerform: false },
  { trade: "hvac", canPerform: false },
  { trade: "painting", canPerform: true },
  { trade: "concrete", canPerform: true },
  { trade: "roofing", canPerform: false },
  { trade: "flooring", canPerform: true },
  { trade: "drywall", canPerform: true },
  { trade: "insulation", canPerform: true },
  { trade: "demolition", canPerform: true },
  { trade: "excavation", canPerform: false },
  { trade: "landscaping", canPerform: false },
  { trade: "fire_protection", canPerform: false },
  { trade: "low_voltage", canPerform: false },
  { trade: "glazing", canPerform: false },
  { trade: "masonry", canPerform: false },
  { trade: "welding", canPerform: false },
  { trade: "other", canPerform: false },
];

async function main() {
  for (const cap of capabilities) {
    await prisma.inHouseCapability.upsert({
      where: { trade: cap.trade },
      update: { canPerform: cap.canPerform },
      create: { ...cap, capacityCheckAvailable: false },
    });
  }
  console.log(`Seeded ${capabilities.length} in-house capabilities`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
