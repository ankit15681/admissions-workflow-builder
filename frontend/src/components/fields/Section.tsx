import type { ReactNode } from "react";

// Container/layout atom — a titled group of fields (Brevo's `bordered_section`). It's the
// fractal step up from a leaf field: a group is itself a unit that composes child fields.
// Purely presentational; it holds no value and imposes no data shape (the config stays flat).
export interface SectionProps {
  title?: string;
  children: ReactNode;
}

export function Section({ title, children }: SectionProps) {
  return (
    <div className="field-section">
      {title && <div className="field-section__title">{title}</div>}
      {children}
    </div>
  );
}
