import { useState, type ReactNode } from "react";

// Collapsible group of an inspector tab (title row with a ▸ chevron).
export default function Section({ title, defaultOpen, children }: { title: string; defaultOpen: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details className="seq-collapse" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="seq-form__title">{title}</summary>
      {children}
    </details>
  );
}
