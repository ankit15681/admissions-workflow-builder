import { createApp } from "./app";
import { db } from "./db";
import { startScheduler } from "./engine/scheduler";
import { seedIfEmpty } from "./seed/seedWorkflows";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

async function main() {
  await seedIfEmpty(db);

  const app = createApp();
  startScheduler(db, 1000);

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Admissions workflow backend listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server:", err);
  process.exit(1);
});
