import { useEffect, useRef, useState, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { useAgentStore } from '../../stores/agentStore'
import { OfficeState } from '../../office/engine/officeState'
import { startGameLoop } from '../../office/engine/gameLoop'
import { renderFrame } from '../../office/engine/renderer'
import { TILE_SIZE } from '../../office/types'
import type { OfficeLayout } from '../../office/types'
import { loadAllAssets } from '../../office/assetLoader'
import { deserializeLayout } from '../../office/layout/layoutSerializer'

const ROLE_PALETTE: Record<string, number> = {
  orchestrator: 0,
  frontend: 1,
  backend: 2,
  testing: 3,
  architect: 4,
  devops: 5,
  security: 0,
  uiux: 1,
}

async function loadOfficeLayout(): Promise<OfficeLayout | null> {
  try {
    const resp = await fetch('/assets/default-layout.json')
    if (!resp.ok) return null
    const json = await resp.text()
    return deserializeLayout(json)
  } catch {
    return null
  }
}

export function OfficeView() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const officeRef = useRef<OfficeState | null>(null)
  const panRef = useRef({ x: 0, y: 0 })
  const zoomRef = useRef(3)
  const stopRef = useRef<(() => void) | null>(null)
  const agentMapRef = useRef(new Map<string, number>())
  const nextIdRef = useRef(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { currentRun } = useAgentStore()

  // Load assets + layout
  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        // Load sprites first
        const assetsOk = await loadAllAssets()
        if (cancelled) return
        if (!assetsOk) {
          setError('Assets konnten nicht geladen werden')
          setLoading(false)
          return
        }

        setLoading(false)
      } catch (err) {
        if (!cancelled) {
          setError(`Fehler: ${err}`)
          setLoading(false)
        }
      }
    }

    init()
    return () => { cancelled = true }
  }, [])

  // Initialize office + game loop
  useEffect(() => {
    if (loading || error || !canvasRef.current) return

    const canvas = canvasRef.current

    // Load the real office layout
    loadOfficeLayout().then((layout) => {
      // Use loaded layout or create OfficeState without layout (will use createDefaultLayout internally)
      const office = layout ? new OfficeState(layout) : new OfficeState()
      officeRef.current = office

      // Center camera on the office
      const cols = layout?.cols || 20
      const rows = layout?.rows || 11
      const centerX = (cols * TILE_SIZE) / 2
      const centerY = (rows * TILE_SIZE) / 2
      panRef.current = {
        x: canvas.width / 2 - centerX * zoomRef.current,
        y: canvas.height / 2 - centerY * zoomRef.current,
      }

      const stop = startGameLoop(canvas, {
        update: (dt: number) => office.update(dt),
        render: (ctx: CanvasRenderingContext2D) => {
          ctx.fillStyle = '#0a0e27'
          ctx.fillRect(0, 0, canvas.width, canvas.height)

          renderFrame(
            ctx,
            canvas.width,
            canvas.height,
            office.tileMap,
            office.furniture,
            office.getCharacters(),
            zoomRef.current,
            panRef.current.x,
            panRef.current.y,
            undefined,
            undefined,
            layout?.tileColors || undefined,
            cols,
            rows,
          )
        },
      })

      stopRef.current = stop
    })

    return () => {
      if (stopRef.current) stopRef.current()
      stopRef.current = null
      officeRef.current = null
    }
  }, [loading, error])

  // Resize handler
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const dpr = window.devicePixelRatio || 1
      canvas.width = parent.clientWidth * dpr
      canvas.height = parent.clientHeight * dpr
      canvas.style.width = `${parent.clientWidth}px`
      canvas.style.height = `${parent.clientHeight}px`
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas.parentElement!)
    return () => observer.disconnect()
  }, [loading])

  // Sync agents
  useEffect(() => {
    const office = officeRef.current
    if (!office || !currentRun) return

    for (const agent of currentRun.agents) {
      let numId = agentMapRef.current.get(agent.id)
      if (numId === undefined) {
        numId = nextIdRef.current++
        const palette = ROLE_PALETTE[agent.role] ?? (numId % 6)
        const hueShift = (palette * 60) % 360
        try {
          office.addAgent(numId, palette, hueShift)
          agentMapRef.current.set(agent.id, numId)
        } catch { /* ok */ }
      }

      try {
        const isActive = agent.status === 'working' || agent.status === 'thinking'
        office.setAgentActive(numId, isActive)
        if (agent.status === 'working') office.setAgentTool(numId, 'Edit')
        else if (agent.status === 'thinking') office.setAgentTool(numId, 'Read')
      } catch { /* ok */ }
    }
  }, [currentRun?.agents])

  // Clear agents on run end
  useEffect(() => {
    if (!currentRun && agentMapRef.current.size > 0) {
      const office = officeRef.current
      if (office) {
        for (const numId of agentMapRef.current.values()) {
          try { office.removeAgent(numId) } catch { /* ok */ }
        }
      }
      agentMapRef.current.clear()
    }
  }, [currentRun])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -1 : 1
      zoomRef.current = Math.max(1, Math.min(8, zoomRef.current + delta))
    } else {
      panRef.current = {
        x: panRef.current.x - e.deltaX,
        y: panRef.current.y - e.deltaY,
      }
    }
  }, [])

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-5 h-5 animate-spin text-accent mx-auto mb-2" />
          <p className="text-[10px] text-text-muted font-mono">Loading Office...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-[10px] text-danger font-mono">{error}</p>
      </div>
    )
  }

  return (
    <div className="w-full h-full relative overflow-hidden">
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        className="w-full h-full"
        style={{ imageRendering: 'pixelated' }}
      />
      {currentRun && currentRun.agents.length > 0 && (
        <div className="absolute top-2 left-2 glass rounded-lg px-2.5 py-1 text-[10px] font-mono">
          <span className="text-accent">{currentRun.agents.length}</span>
          <span className="text-text-muted ml-1">agents active</span>
        </div>
      )}
    </div>
  )
}
