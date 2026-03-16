import { useEffect, useRef, useState, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { useAgentStore } from '../../stores/agentStore'
import { OfficeState } from '../../office/engine/officeState'
import { startGameLoop } from '../../office/engine/gameLoop'
import { renderFrame } from '../../office/engine/renderer'
import { TILE_SIZE } from '../../office/types'
import type { OfficeLayout, TileType } from '../../office/types'
import { loadAllAssets } from '../../office/assetLoader'

// Build a small office layout with desks
function createOfficeLayout(): OfficeLayout {
  const cols = 16
  const rows = 10
  const tiles: TileType[] = []

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) {
        tiles.push(0 as TileType) // WALL
      } else {
        tiles.push(1 as TileType) // FLOOR_1
      }
    }
  }

  return {
    version: 1,
    cols,
    rows,
    tiles,
    furniture: [],
    tileColors: tiles.map((t) =>
      t === 0 ? null : { h: 220, s: 15, b: -15, c: 0 }
    ),
  }
}

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

export function OfficeView() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const officeRef = useRef<OfficeState | null>(null)
  const panRef = useRef({ x: 0, y: 0 })
  const zoomRef = useRef(3)
  const stopRef = useRef<(() => void) | null>(null)
  const agentMapRef = useRef(new Map<string, number>()) // string agentId → numeric office id
  const nextIdRef = useRef(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { currentRun } = useAgentStore()

  // Load assets and initialize
  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const success = await loadAllAssets()
        if (cancelled) return

        if (!success) {
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

  // Initialize office + game loop after loading
  useEffect(() => {
    if (loading || error || !canvasRef.current) return

    const canvas = canvasRef.current
    const layout = createOfficeLayout()
    const office = new OfficeState(layout)
    officeRef.current = office

    // Center camera
    const centerX = (layout.cols * TILE_SIZE) / 2
    const centerY = (layout.rows * TILE_SIZE) / 2
    panRef.current = {
      x: canvas.width / 2 - centerX * zoomRef.current,
      y: canvas.height / 2 - centerY * zoomRef.current,
    }

    const stop = startGameLoop(canvas, {
      update: (dt: number) => office.update(dt),
      render: (ctx: CanvasRenderingContext2D) => {
        ctx.fillStyle = '#0f0f23'
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
        )
      },
    })

    stopRef.current = stop
    return () => {
      stop()
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

      // Re-center if office exists
      if (officeRef.current) {
        const layout = createOfficeLayout()
        const centerX = (layout.cols * TILE_SIZE) / 2
        const centerY = (layout.rows * TILE_SIZE) / 2
        panRef.current = {
          x: canvas.width / 2 - centerX * zoomRef.current,
          y: canvas.height / 2 - centerY * zoomRef.current,
        }
      }
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas.parentElement!)
    return () => observer.disconnect()
  }, [loading])

  // Sync agents from store
  useEffect(() => {
    const office = officeRef.current
    if (!office || !currentRun) return

    for (const agent of currentRun.agents) {
      let numId = agentMapRef.current.get(agent.id)
      if (numId === undefined) {
        numId = nextIdRef.current++
        const palette = ROLE_PALETTE[agent.role] ?? 0
        const hueShift = (palette * 60) % 360
        try {
          office.addAgent(numId, palette, hueShift)
          agentMapRef.current.set(agent.id, numId)
        } catch { /* might already exist */ }
      }

      // Update activity
      try {
        const isActive = agent.status === 'working' || agent.status === 'thinking'
        office.setAgentActive(numId, isActive)
        if (agent.status === 'working') {
          office.setAgentTool(numId, 'Edit')
        } else if (agent.status === 'thinking') {
          office.setAgentTool(numId, 'Read')
        }
      } catch { /* character might not exist */ }
    }
  }, [currentRun?.agents])

  // Clear agents when run finishes
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
      <div className="w-full h-full flex items-center justify-center bg-bg-primary">
        <div className="text-center">
          <Loader2 className="w-6 h-6 animate-spin text-accent mx-auto mb-2" />
          <p className="text-xs text-text-muted">Lade Pixel Office...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-bg-primary">
        <p className="text-xs text-error">{error}</p>
      </div>
    )
  }

  return (
    <div className="w-full h-full relative overflow-hidden bg-bg-primary">
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        className="w-full h-full"
        style={{ imageRendering: 'pixelated' }}
      />
      {currentRun && currentRun.agents.length > 0 && (
        <div className="absolute top-2 left-2 bg-bg-card/80 backdrop-blur-sm border border-border rounded-lg px-3 py-1.5 text-xs">
          <span className="text-accent font-medium">{currentRun.agents.length}</span>
          <span className="text-text-muted ml-1">Agenten im Büro</span>
        </div>
      )}
      {!currentRun && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-text-muted text-xs bg-bg-card/60 px-3 py-1.5 rounded-lg">
            Starte einen Task — Agenten erscheinen hier
          </p>
        </div>
      )}
    </div>
  )
}
