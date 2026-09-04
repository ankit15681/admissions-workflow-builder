import { Router } from "express";
import { listStepTypes } from "../stepTypes/registry";
import { toPublic } from "../stepTypes/types";
import { listConditionTypes } from "../stepTypes/conditions/registry";
import { stepCategories } from "../stepTypes/categories";
import { RECIPIENT_VARIABLES } from "../stepTypes/variables/recipientVariables";

export const stepTypesRouter = Router();

// The public projection of the registry — everything except execute() — exactly as
// authored server-side, no conversion step (C.6.1).
stepTypesRouter.get("/step-types", (_req, res) => {
  res.json(listStepTypes().map(toPublic));
});

// Palette catalog metadata — category labels + ordering — served rather than hardcoded on
// the frontend (modelled on Brevo's getCategoryData). See stepTypes/categories.ts.
stepTypesRouter.get("/step-categories", (_req, res) => {
  res.json(stepCategories);
});

// Branches' condition sub-registry (C.6.2) — fetched once by the Branches custom editor.
stepTypesRouter.get("/condition-types", (_req, res) => {
  res.json(listConditionTypes());
});

// Communicate's recipient -> variable data map (C.4) — fetched once by the Communicate
// custom editor so its variable picker only offers variables valid for the selected recipient.
stepTypesRouter.get("/recipient-variables", (_req, res) => {
  res.json(RECIPIENT_VARIABLES);
});
