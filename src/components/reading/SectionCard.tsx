import type { SectionAccent } from "./sectionUtils";

type SectionCardProps = {
  id: string;
  title: string | null;
  accent: SectionAccent;
  children: React.ReactNode;
};

const ACCENT_CLASS: Record<SectionAccent, string> = {
  default: "section-card--default",
  purple: "section-card--purple",
  orange: "section-card--orange",
  green: "section-card--green",
  blue: "section-card--blue",
};

export default function SectionCard({ id, title, accent, children }: SectionCardProps) {
  return (
    <section
      id={id}
      className={`section-card ${ACCENT_CLASS[accent]}`}
      aria-labelledby={title ? `${id}-heading` : undefined}
    >
      {title && (
        <header className="section-card__header">
          <h2 id={`${id}-heading`} className="section-card__title">{title}</h2>
        </header>
      )}
      <div className="section-card__body">{children}</div>
    </section>
  );
}
