"use client";

// Tiny inline SVG line chart for KPI cards. ~40px tall, fits inside
// the card's right edge. Hand-rolled so we don't pull a chart lib for
// 30 lines of SVG. The line uses currentColor so the parent card's
// accent class can tint it, plus a soft area fill underneath.

export function MiniSparkline({
  data,
  height = 32,
  width = 120,
  className,
}: {
  data: number[];
  height?: number;
  width?: number;
  className?: string;
}) {
  if (data.length === 0) {
    return <div style={{ height, width }} aria-hidden />;
  }

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = Math.max(1, max - min);
  const stepX = width / Math.max(1, data.length - 1);

  // Build the polyline path (top-positive Y so we invert).
  const pts = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return [x, y] as const;
  });

  const linePath = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      style={{ overflow: "visible" }}
      aria-hidden
    >
      {/* Soft area fill — currentColor at 18% so it picks up the
          card's accent automatically. Fades in alongside the line. */}
      <path
        d={areaPath}
        fill="currentColor"
        opacity={0.18}
        style={{ animation: "count-up-rise 0.6s cubic-bezier(0.22,1,0.36,1) 0.4s both" }}
      />
      {/* `pathLength="1"` normalizes the dasharray space to [0,1] so we
          can set `stroke-dasharray: 1` in CSS and animate dashoffset
          1→0 to "draw" the line regardless of actual path length. */}
      <path
        d={linePath}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        className="animate-stroke-draw"
      />
      {/* Endpoint dot — picks the eye on the latest value. Pops in
          right after the stroke finishes. */}
      <circle
        cx={pts[pts.length - 1]?.[0] ?? 0}
        cy={pts[pts.length - 1]?.[1] ?? 0}
        r={2.5}
        fill="currentColor"
        style={{ animation: "count-up-rise 0.4s cubic-bezier(0.22,1,0.36,1) 0.85s both" }}
      />
    </svg>
  );
}
