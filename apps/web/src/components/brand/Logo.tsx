interface LogoProps {
  size?: number
  variant?: 'light' | 'dark' | 'auto'
  showText?: boolean
}

export default function Logo({ size = 36, variant = 'auto', showText = true }: LogoProps) {
  // Para 'auto', usamos classes CSS (dark:) mas para SVG precisamos determinar a cor
  // Se variant='auto', usamos uma cor neutra que funcione bem em ambos os modos
  const isDark = variant === 'dark';
  const isLight = variant === 'light';

  const circleBg = isDark ? '#52B788' : '#2D6A4F';
  const textFill = '#FFFFFF';
  const leafFill = '#52B788';
  const leafStroke = '#2D6A4F';

  return (
    <div className="flex items-center gap-2.5">
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        className={isLight ? 'text-rv-green' : isDark ? 'text-rv-vivid' : 'text-rv-green dark:text-rv-vivid'}
      >
        <circle cx="60" cy="60" r="60" fill={circleBg} className="[&.dark]:fill-[#52B788]" />
        <text
          x="58"
          y="63"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="var(--font-poppins), sans-serif"
          fontWeight="700"
          fontSize="62"
          letterSpacing="-5"
          fill={textFill}
        >
          RV
        </text>
        <g transform="translate(83 30) rotate(33)">
          <path
            d="M0,-15 C9,-9 9,5 0,15 C-9,5 -9,-9 0,-15 Z"
            fill={leafFill}
          />
          <path
            d="M0,-11.5 L0,11.5"
            stroke={leafStroke}
            strokeWidth="1.7"
            strokeLinecap="round"
            fill="none"
            opacity="0.6"
          />
        </g>
      </svg>
      {showText && (
        <div className="flex flex-col">
          <span className="font-[var(--font-poppins)] font-semibold text-sm">
            <span className="text-rv-forest dark:text-white">Renda</span>
            <span className="text-rv-green dark:text-rv-soft"> Viva</span>
          </span>
          <span className="text-rv-muted dark:text-rv-dark-muted text-[10px] block -mt-0.5">
            Gestão Inteligente
          </span>
        </div>
      )}
    </div>
  )
}
