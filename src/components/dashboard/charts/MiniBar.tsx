interface BarItem {
  label: string
  value: number
  color: string
}

interface MiniBarProps {
  data: BarItem[]
  maxValue?: number
}

export function MiniBar({ data, maxValue }: MiniBarProps) {
  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1)

  return (
    <div className="space-y-2">
      {data.map((item) => (
        <div key={item.label}>
          <div className="flex justify-between mb-0.5">
            <span className="text-[10px] text-text-secondary font-mono">{item.label}</span>
            <span className="text-[10px] text-text-muted font-mono">{item.value}</span>
          </div>
          <div className="w-full h-2 rounded-full bg-bg-surface overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(item.value / max) * 100}%`,
                backgroundColor: item.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
