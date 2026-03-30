import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const TRADE_MAP: Record<string, string> = {
  laborer: "general_labor",
  carpenter: "carpentry",
  electrician: "electrical",
  superintendent: "other",
  pm: "other",
};

async function main() {
  const employees = await prisma.employee.findMany({
    select: { id: true, tradeClassification: true },
  });

  let updated = 0;
  for (const emp of employees) {
    const newTrade = TRADE_MAP[emp.tradeClassification];
    if (newTrade && newTrade !== emp.tradeClassification) {
      await prisma.employee.update({
        where: { id: emp.id },
        data: { tradeClassification: newTrade },
      });
      updated++;
    }
  }

  console.log(`Migrated ${updated} of ${employees.length} employee trade classifications`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
