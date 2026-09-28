export interface Slice {
  label: string;
  value: number;
  color: string;
}

/** Gráfico de rosca simples em SVG */
export function Donut({ data, size = 120, thickness = 18, center }: { data: Slice[]; size?: number; thickness?: number; center?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Despesas por categoria">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-1)" strokeWidth={thickness} />
      {total > 0 &&
        data.map((d) => {
          const len = (d.value / total) * c;
          const el = (
            <circle
              key={d.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth={thickness}
              strokeDasharray={`${Math.max(len - 1.5, 0)} ${c - Math.max(len - 1.5, 0)}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          offset += len;
          return el;
        })}
      {center && (
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="donut-center">
          {center}
        </text>
      )}
    </svg>
  );
}
