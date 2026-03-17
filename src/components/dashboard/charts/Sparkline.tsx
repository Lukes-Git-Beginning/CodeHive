interface SparklineProps {
  data: number[]
  color: string
  height?: number
  width?: number
}

export function Sparkline({ data, color, height = 32, width = 120 }: SparklineProps) {
  if (data.length < 2) {
    return (
      <div style={{ width, height }} className="flex items-center justify-center">
        <span className="text-[8px] text-text-muted">—</span>
      </div>
    )
  }

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const padding = 2

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2)
    const y = padding + (1 - (v - min) / range) * (height - padding * 2)
    return `${x},${y}`
  }).join(' ')

  const fillPoints = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`sparkGrad-${color.replace(/[^a-z0-9]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={fillPoints}
        fill={`url(#sparkGrad-${color.replace(/[^a-z0-9]/gi, '')})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
