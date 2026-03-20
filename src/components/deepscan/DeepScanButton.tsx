import { ScanLine } from 'lucide-react'
import { useDeepScanStore } from '../../stores/deepScanStore'

interface DeepScanButtonProps {
  onClick: () => void
}

export function DeepScanButton({ onClick }: DeepScanButtonProps) {
  const isScanning = useDeepScanStore((s) => s.isScanning)
  const progress = useDeepScanStore((s) => s.progress)

  return (
    <button
      onClick={onClick}
      className={`p-2 rounded transition-all ${
        isScanning
          ? 'text-accent bg-accent/10 animate-pulse'
          : 'text-text-muted hover:text-emerald-400 hover:bg-white/5'
      }`}
      aria-label="Deep Scan (Ctrl+Shift+D)"
      title={isScanning ? `Scanning... ${progress?.progress ?? 0}%` : 'Deep Scan (Ctrl+Shift+D)'}
    >
      <ScanLine className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} style={isScanning ? { animationDuration: '3s' } : undefined} />
    </button>
  )
}
