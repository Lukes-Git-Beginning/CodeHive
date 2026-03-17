interface MiniDonutProps {
  value: number
  color: string
  size?: number
  label?: string
}

export function MiniDonut({ value, color, size = 64, label }: MiniDonutProps) {
  const clamped = Math.max(0, Math.min(100, value))
  const innerSize = size * 0.7

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="relative rounded-full"
        style={{
          width: size,
          height: size,
          background: `conic-gradient(${color} 0% ${clamped}%, rgba(255,255,255,0.06) ${clamped}% 100%)`,
        }}
      >
        <div
          className="absolute rounded-full bg-bg-deep flex items-center justify-center"
          style={{
            width: innerSize,
            height: innerSize,
            top: (size - innerSize) / 2,
            left: (size - innerSize) / 2,
          }}
        >
          <span className="font-mono text-xs" style={{ color }}>{clamped}%</span>
        </div>
      </div>
      {label && <span className="font-hud text-[8px] text-text-muted">{label}</span>}
    </div>
  )
}
