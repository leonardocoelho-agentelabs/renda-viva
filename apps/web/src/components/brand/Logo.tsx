interface LogoProps {
  size?: number
  variant?: 'light' | 'dark'
  showText?: boolean
}

export default function Logo({ size = 32, variant = 'light', showText = true }: LogoProps) {
  const bg = variant === 'light' ? '#2D6A4F' : '#52B788'
  const fg = variant === 'light' ? '#FFFFFF' : '#0E1F18'
  const leaf = variant === 'light' ? '#52B788' : '#0E1F18'

  return (
    <div className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="60" fill={bg} />
        <text x="58" y="63" textAnchor="middle" dominantBaseline="central"
          fontFamily="var(--font-poppins)" fontWeight="700" fontSize="62"
          letterSpacing="-5" fill={fg}>RV</text>
        <g transform="translate(83 30) rotate(33)">
          <path d="M0,-15 C9,-9 9,5 0,15 C-9,5 -9,-9 0,-15 Z" fill={leaf} />
        </g>
      </svg>
      {showText && (
        <span className="font-heading font-semibold text-base text-rv-forest dark:text-rv-dark-ink">
          Renda Viva
        </span>
      )}
    </div>
  )
}
