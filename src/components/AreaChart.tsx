// No top-level React import needed in modern JSX setup

type Series = {
  name: string;
  values: number[];
  color: string;
};

type Props = {
  labels: string[];
  series: Series[];
  height?: number;
};

function pointsPath(values: number[], width: number, height: number) {
  if (values.length === 0) return "";
  const max = Math.max(...values);
  const step = width / Math.max(1, values.length - 1);
  return values
    .map((v, i) => {
      const x = i * step;
      const y = height - (v / max) * height;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export default function AreaChart({ labels, series, height = 220 }: Props) {
  const width = Math.max(300, labels.length * 80);

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        <defs>
          {series.map((s, idx) => (
            <linearGradient
              key={s.name}
              id={`grad-${idx}`}
              x1="0"
              x2="0"
              y1="0"
              y2="1"
            >
              <stop offset="0%" stopColor={s.color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.02" />
            </linearGradient>
          ))}
        </defs>

        {/* grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
          <line
            key={i}
            x1={0}
            x2={width}
            y1={t * height}
            y2={t * height}
            stroke="#eef2f7"
            strokeWidth={1}
          />
        ))}

        {/* series areas and lines */}
        {series.map((s, idx) => {
          const path = pointsPath(s.values, width, height - 30);
          const area =
            path.replace(/^M/, "M") +
            ` L ${width} ${height - 30} L 0 ${height - 30} Z`;
          return (
            <g key={s.name} transform="translate(0,0)">
              <path d={area} fill={`url(#grad-${idx})`} />
              <path
                d={path}
                fill="none"
                stroke={s.color}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          );
        })}

        {/* labels */}
        {labels.map((lab, i) => {
          const x = (i * width) / Math.max(1, labels.length - 1);
          return (
            <text
              key={lab}
              x={x}
              y={height - 6}
              fontSize={12}
              fill="#6b7280"
              textAnchor={
                i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle"
              }
            >
              {lab}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
