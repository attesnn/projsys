import "dotenv/config";
import { createSeedData } from "../src/lib/seed";
import { saveAppDataToDb } from "../src/lib/appDataDb";

async function main() {
  const seed = createSeedData();
  await saveAppDataToDb(seed);
  console.log(
    `Seeded: ${seed.resources.length} resources, ${seed.projects.length} projects, ${seed.assignments.length} assignments, ${seed.tasks.length} tasks`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/db");
    await prisma.$disconnect();
  });
