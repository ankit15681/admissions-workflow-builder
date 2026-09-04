import express from "express";
import cors from "cors";
import { stepTypesRouter } from "./routes/stepTypes";
import { workflowsRouter } from "./routes/workflows";
import { runsRouter } from "./routes/runs";
import { applicationsRouter } from "./routes/applications";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  app.use("/api", stepTypesRouter);
  app.use("/api", workflowsRouter);
  app.use("/api", runsRouter);
  app.use("/api", applicationsRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  });

  return app;
}
