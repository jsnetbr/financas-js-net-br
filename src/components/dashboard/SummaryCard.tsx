export function SummaryCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: string;
}) {
  return (
    <article className={`summary-card ${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
    </article>
  );
}
