import type { StepCategory } from "./types";

// Catalog metadata served to the builder — the palette's category labels and ordering,
// modelled on Brevo's getCategoryData (which serves category grouping + a `sequence` order
// rather than hardcoding it in the frontend). Adding/reordering a category is a data change
// here, not a frontend edit.
export interface StepCategoryMeta {
  key: StepCategory;
  label: string;
  order: number;
}

export const stepCategories: StepCategoryMeta[] = [
  { key: "communication", label: "Communication", order: 1 },
  { key: "flow", label: "Flow control", order: 2 },
  { key: "application", label: "Application", order: 3 },
  { key: "staff", label: "Staff", order: 4 },
  { key: "scheduling", label: "Scheduling", order: 5 },
];
