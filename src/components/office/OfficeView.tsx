import { useEffect, useRef, useCallback } from 'react'
import { useAgentStore } from '../../stores/agentStore'
import { OfficeState } from '../../office/engine/officeState'
import { startGameLoop } from '../../office/engine/gameLoop'
import { renderFrame } from '../../office/engine/renderer'
import { TILE_SIZE } from '../../office/types'
import {
  ZOOM_MIN,
  ZOOM_MAX,
  CAMERA_FOLLOW_LERP,
  CAMERA_FOLLOW_SNAP_THRESHOLD,
} from '../../office/constants'

// Simple default office layout
const DEFAULT_LAYOUT = {
  cols: 14,
  rows: 8,
  tiles: Array(8).fill(null).map((_, r) =>
    Array(14).fill(null).map((_, c) => {
      if (r === 0 || r === 7 || c === 0 || c === 13) return 1 // WALL
      return 2 // FLOOR_1
    })
  ),
  furniture: [],
  floorColor: { h: 220, s: 20, b: -10, c: 0 },
  wallColor: { h: 240, s: 25, b: 0, c: 0 },
}

// Desk positions for agents (col, row)
const DESK_POSITIONS = [
  { col: 3, row: 2 },
  { col: 6, row: 2 },
  { col: 9, row: 2 },
  { col: 3, row: 5 },
  { col: 6, row: 5 },
  { col: 9, row: 5 },
]

// Agent role → character palette mapping
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
  const agentMapRef = useRef(new Map<string, number>()) // agentId → desk index

  const { currentRun } = useAgentStore()

  // Initialize office
  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const office = new OfficeState(DEFAULT_LAYOUT as any)
    officeRef.current = office

    // Center the camera
    const centerX = (DEFAULT_LAYOUT.cols * TILE_SIZE) / 2
    const centerY = (DEFAULT_LAYOUT.rows * TILE_SIZE) / 2
    panRef.current = {
      x: canvas.width / 2 - centerX * zoomRef.current,
      y: canvas.height / 2 - centerY * zoomRef.current,
    }

    // Start game loop
    const stop = startGameLoop(canvas, {
      update: (dt: number) => {
        office.update(dt)
      },
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
          null, // selectedId
          null, // hoveredId
          false, // editMode
          null, // ghostPreview
          null, // selectionRect
          null, // followTarget
        )
      },
    })

    stopRef.current = stop

    return () => {
      stop()
      stopRef.current = null
    }
  }, [])

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
  }, [])

  // Sync agents from store to office characters
  useEffect(() => {
    const office = officeRef.current
    if (!office || !currentRun) return

    const existingIds = new Set(agentMapRef.current.keys())
    const currentIds = new Set(currentRun.agents.map((a) => a.id))

    // Add new agents
    for (const agent of currentRun.agents) {
      if (!existingIds.has(agent.id)) {
        const deskIdx = agentMapRef.current.size % DESK_POSITIONS.length
        const palette = ROLE_PALETTE[agent.role] ?? 0
        const hueShift = (palette * 60) % 360

        try {
          const desk = DESK_POSITIONS[deskIdx]
          office.addAgent(agent.id, palette, hueShift, `desk-${deskIdx}`)
          agentMapRef.current.set(agent.id, deskIdx)
        } catch {
          // Agent might already exist
        }
      }

      // Update activity
      const isActive = agent.status === 'working' || agent.status === 'thinking'
      try {
        office.setAgentActive(agent.id, isActive)
        if (agent.status === 'working') {
          office.setAgentTool(agent.id, 'Edit')
        } else if (agent.status === 'thinking') {
          office.setAgentTool(agent.id, 'Read')
        }
      } catch {
        // Character might not exist yet
      }
    }

    // Remove finished agents (with delay for animation)
    for (const id of existingIds) {
      if (!currentIds.has(id)) {
        try {
          office.removeAgent(id)
        } catch {
          // Already removed
        }
        agentMapRef.current.delete(id)
      }
    }
  }, [currentRun?.agents])

  // Clear agents when run finishes
  useEffect(() => {
    if (!currentRun && agentMapRef.current.size > 0) {
      const office = officeRef.current
      if (office) {
        for (const id of agentMapRef.current.keys()) {
          try { office.removeAgent(id) } catch { /* ok */ }
        }
      }
      agentMapRef.current.clear()
    }
  }, [currentRun])

  // Zoom handler
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -1 : 1
      zoomRef.current = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomRef.current + delta))
    } else {
      panRef.current = {
        x: panRef.current.x - e.deltaX,
        y: panRef.current.y - e.deltaY,
      }
    }
  }, [])

  return (
    <div className="w-full h-full relative overflow-hidden bg-bg-primary">
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        className="w-full h-full"
        style={{ imageRendering: 'pixelated' }}
      />
      {/* Overlay: Agent count */}
      {currentRun && currentRun.agents.length > 0 && (
        <div className="absolute top-2 left-2 bg-bg-card/80 backdrop-blur-sm border border-border rounded-lg px-3 py-1.5 text-xs">
          <span className="text-accent font-medium">{currentRun.agents.length}</span>
          <span className="text-text-muted ml-1">Agenten im Büro</span>
        </div>
      )}
      {!currentRun && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-text-muted text-sm bg-bg-card/60 px-4 py-2 rounded-lg">
            Starte einen Task — Agenten erscheinen hier
          </p>
        </div>
      )}
    </div>
  )
}
