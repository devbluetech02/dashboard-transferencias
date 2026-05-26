"use client";

interface Slice {
  key: string;
  label: string;
  value: number;
  color: string;
}

export function Donut({
  data,
  size = 180,
  thickness = 22,
  centerLabel,
  centerValue,
}: {
  data: Slice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string | number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-4 md:flex-row md:items-start">
      <svg width={size} height={size} className="shrink-0 -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={thickness}
        />
        {total > 0 &&
          data.map((d) => {
            const len = (d.value / total) * c;
            const seg = (
              <circle
                key={d.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={d.color}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += len;
            return seg;
          })}
        <g transform={`rotate(90 ${size / 2} ${size / 2})`}>
          <text
            x={size / 2}
            y={size / 2 - 4}
            textAnchor="middle"
            className="fill-[var(--text)] text-2xl font-semibold"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {centerValue ?? total}
          </text>
          {centerLabel && (
            <text
              x={size / 2}
              y={size / 2 + 14}
              textAnchor="middle"
              className="fill-[var(--text-muted)] text-[10px] uppercase tracking-wider"
            >
              {centerLabel}
            </text>
          )}
        </g>
      </svg>
      <div className="flex-1 w-full grid grid-cols-1 gap-1.5 text-sm">
        {data.map((d) => {
          const pct = total ? (d.value / total) * 100 : 0;
          return (
            <div
              key={d.key}
              className="grid grid-cols-[12px_1fr_auto_auto] gap-2 items-center"
            >
              <span
                className="size-2.5 rounded-full"
                style={{ background: d.color }}
              />
              <span className="truncate text-[13px]">{d.label}</span>
              <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                {pct.toFixed(1)}%
              </span>
              <span className="text-[13px] font-medium tabular-nums w-10 text-right">
                {d.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
