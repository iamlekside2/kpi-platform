/**
 * A bare trend line for a KPI card. Deliberately not a chart: no axes, no
 * grid, no tooltip — just the shape of the run, with the full figures a click
 * away in the history panel. Inline SVG rather than recharts so a page of
 * thirty cards stays cheap.
 */
export default function KPISparkline({ readings, className = '' }) {
  // Readings arrive newest first; a line reads left-to-right in time.
  const points = [...(readings || [])].reverse();
  if (points.length < 2) return null;

  const W = 100;
  const H = 28;
  const PAD = 2;

  const values = points.map((r) => r.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat series would divide by zero; draw it down the middle instead.
  const span = max - min || 1;

  const coords = points.map((r, i) => {
    const x = PAD + (i / (points.length - 1)) * (W - PAD * 2);
    const y = max === min ? H / 2 : PAD + (1 - (r.value - min) / span) * (H - PAD * 2);
    return [x, y];
  });

  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${coords[coords.length - 1][0].toFixed(1)},${H} L${coords[0][0].toFixed(1)},${H} Z`;
  const [lastX, lastY] = coords[coords.length - 1];
  const gradientId = `spark-${points[0].id}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={`w-full h-7 overflow-visible ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r="2" fill="currentColor" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
