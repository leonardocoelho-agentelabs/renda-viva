interface RendaVivaMarkProps {
  size?: number;
  variant?: "circle" | "square" | "ring";
  bg?: string;
  fg?: string;
  leaf?: string;
  vein?: string;
  className?: string;
}

export function RendaVivaMark({
  size = 120,
  variant = "circle",
  bg = "#2D6A4F",
  fg = "#FFFFFF",
  leaf = "#52B788",
  vein = "rgba(255,255,255,0.55)",
  className = "",
}: RendaVivaMarkProps) {
  const viewBoxSize = 120;
  const center = viewBoxSize / 2;
  const radius = 50;
  const fontSize = 62;
  const letterSpacing = -5;

  // Leaf position (top-right of circle)
  const leafX = 83;
  const leafY = 30;
  const leafRotation = 33;

  // Square variant properties
  const squareRx = 28;
  const squareWidth = 100;
  const squareX = (viewBoxSize - squareWidth) / 2;
  const squareY = (viewBoxSize - squareWidth) / 2;

  const shapeProps = {
    stroke: variant === "ring" ? bg : "none",
    strokeWidth: variant === "ring" ? 4 : 0,
    fill: variant === "ring" ? "none" : bg,
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Renda Viva"
      role="img"
    >
      {/* Main shape (circle or square) */}
      {variant === "square" ? (
        <rect
          x={squareX}
          y={squareY}
          width={squareWidth}
          height={squareWidth}
          rx={squareRx}
          {...shapeProps}
        />
      ) : (
        <circle cx={center} cy={center} r={radius} {...shapeProps} />
      )}

      {/* Monogram "RV" */}
      <text
        x={center}
        y={center}
        dominantBaseline="central"
        textAnchor="middle"
        fill={fg}
        fontSize={fontSize}
        fontFamily="Poppins, system-ui, sans-serif"
        fontWeight={700}
        letterSpacing={letterSpacing}
      >
        RV
      </text>

      {/* Leaf decoration */}
      <g transform={`translate(${leafX}, ${leafY}) rotate(${leafRotation})`}>
        {/* Leaf body */}
        <path
          d="M0 25 C-8 15, -8 5, 0 -5 C8 5, 8 15, 0 25 Z"
          fill={leaf}
        />
        {/* Leaf vein */}
        <line
          x1="0"
          y1="20"
          x2="0"
          y2="-3"
          stroke={vein}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
