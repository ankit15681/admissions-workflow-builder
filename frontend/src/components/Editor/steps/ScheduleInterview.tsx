import { useScheduleInterview } from "../../../hooks/steps/useScheduleInterview";
import { FieldRenderer } from "../../../lib/fieldRegistry";
import { Section } from "../../fields/Section";
import "../editor.css";

interface Props {
  config: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

// Pure rendering — all data logic (field def, layout, visibility, binding) lives in
// useScheduleInterview, mirroring how each atom pairs a component with a hook.
export function ScheduleInterview({ config, onChange }: Props) {
  const { sections } = useScheduleInterview(config, onChange);
  return (
    <div className="custom-editor">
      {sections.map((section, i) => (
        <Section key={i} title={section.title}>
          {section.fields.map((f) => (
            <FieldRenderer key={f.key} descriptor={f.descriptor} value={f.value} onChange={f.onChange} />
          ))}
        </Section>
      ))}
      <div className="condition-preview">
        Booking the interview creates a record the moment this step runs; a later Branch using
        the <strong>Interview status</strong> condition can route on whether it was completed.
      </div>
    </div>
  );
}
