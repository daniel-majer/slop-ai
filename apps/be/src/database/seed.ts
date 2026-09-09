import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

import { PrismaClient } from "./generated/client.js";

// Run explicitly with bun run db:seed; keep seed data aligned with the schema.

// Load env using the same rule as prisma.config.ts.
const isTest = process.env.NODE_ENV === "test";
config({ path: isTest ? ".env.test" : ".env", override: isTest });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
});

async function seed() {
  // Add upserts here as the schema grows; keep them idempotent.
  await prisma.$connect();

  console.log("seeded: nothing to do yet");
}

seed()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  // Close the pool even if seeding fails.
  .finally(() => prisma.$disconnect());
