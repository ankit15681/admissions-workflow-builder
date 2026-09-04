import { useSectionedForm, type FormSection } from "../useStepForm";
import { number, select, text, type EditorSection, type StepUnitDef } from "../../lib/stepForm";

// Data-logic hook for the Schedule Interview editor — owns the field def + section layout, so
// the component is pure rendering. `room` is only shown/persisted for in-person interviews.
const FIELDS: StepUnitDef = {
  mode: select({
    label: "Mode",
    required: true,
    options: [
      { value: "video", label: "Video call" },
      { value: "in_person", label: "In person" },
    ],
  }),
  room: text({
    label: "Room / location",
    placeholder: "e.g. Admissions Office 2B",
    visibleWhen: (c) => c.mode === "in_person",
  }),
  durationMins: number({ label: "Duration (minutes)", required: true, min: 15 }),
};

const LAYOUT: EditorSection[] = [
  { title: "Interview details", keys: ["mode", "room"] },
  { title: "Scheduling", keys: ["durationMins"] },
];

export function useScheduleInterview(
  config: Record<string, unknown>,
  onChange: (next: Record<string, unknown>) => void
): { sections: FormSection[] } {
  return useSectionedForm(config, onChange, FIELDS, LAYOUT);
}
