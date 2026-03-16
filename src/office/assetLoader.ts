import type { SpriteData } from './types'
import { setCharacterTemplates } from './sprites/spriteData'
import { setFloorSprites } from './floorTiles'
import { buildDynamicCatalog } from './layout/furnitureCatalog'

// Character sprite sheets are 112×96px: 7 columns × 3 rows of 16×32px frames
const CHAR_FRAME_W = 16
const CHAR_FRAME_H = 32
const CHAR_COLS = 7
// Character rows: DOWN, UP, RIGHT (LEFT = flipped RIGHT)

// Floor tiles are 16×16px
const FLOOR_TILE_SIZE = 16

/**
 * Load a PNG image and return its pixel data
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    img.src = src
  })
}

/**
 * Extract pixel data from an image as SpriteData (hex color grid)
 */
function imageToSpriteData(
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
): SpriteData {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, x, y, w, h, 0, 0, w, h)
  const imageData = ctx.getImageData(0, 0, w, h)
  const pixels = imageData.data

  const sprite: SpriteData = []
  for (let row = 0; row < h; row++) {
    const rowData: string[] = []
    for (let col = 0; col < w; col++) {
      const idx = (row * w + col) * 4
      const r = pixels[idx]
      const g = pixels[idx + 1]
      const b = pixels[idx + 2]
      const a = pixels[idx + 3]

      if (a === 0) {
        rowData.push('')
      } else if (a < 255) {
        rowData.push(
          `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}${a.toString(16).padStart(2, '0')}`
        )
      } else {
        rowData.push(
          `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
        )
      }
    }
    sprite.push(rowData)
  }
  return sprite
}

/**
 * Load a single character sprite sheet and extract all frames
 */
async function loadCharacter(index: number): Promise<{
  down: SpriteData[]
  up: SpriteData[]
  right: SpriteData[]
}> {
  const img = await loadImage(`/assets/characters/char_${index}.png`)

  const extractFrames = (row: number): SpriteData[] => {
    const frames: SpriteData[] = []
    for (let col = 0; col < CHAR_COLS; col++) {
      frames.push(
        imageToSpriteData(img, col * CHAR_FRAME_W, row * CHAR_FRAME_H, CHAR_FRAME_W, CHAR_FRAME_H)
      )
    }
    return frames
  }

  return {
    down: extractFrames(0),
    up: extractFrames(1),
    right: extractFrames(2),
  }
}

/**
 * Load floor tile sprites
 */
async function loadFloorSprites(): Promise<SpriteData[]> {
  const sprites: SpriteData[] = []
  for (let i = 0; i <= 8; i++) {
    try {
      const img = await loadImage(`/assets/floors/floor_${i}.png`)
      sprites.push(imageToSpriteData(img, 0, 0, FLOOR_TILE_SIZE, FLOOR_TILE_SIZE))
    } catch {
      // Create empty fallback
      sprites.push(
        Array(FLOOR_TILE_SIZE)
          .fill(null)
          .map(() => Array(FLOOR_TILE_SIZE).fill('#333333'))
      )
    }
  }
  return sprites
}

/**
 * Load furniture manifests and sprites
 */
async function loadFurnitureAssets(): Promise<Record<string, { catalog: any[]; sprites: Record<string, SpriteData> }>> {
  const furnitureTypes = [
    'DESK', 'WOODEN_CHAIR', 'PC', 'PLANT', 'BOOKSHELF', 'WHITEBOARD',
    'COFFEE', 'BIN', 'CACTUS', 'LARGE_PLANT',
  ]

  const assets: Record<string, { catalog: any[]; sprites: Record<string, SpriteData> }> = {}

  for (const type of furnitureTypes) {
    try {
      const response = await fetch(`/assets/furniture/${type}/manifest.json`)
      if (!response.ok) continue
      const manifest = await response.json()

      // Convert sprite pixel arrays from manifest
      const sprites: Record<string, SpriteData> = {}
      if (manifest.sprites) {
        for (const [key, data] of Object.entries(manifest.sprites)) {
          sprites[key] = data as SpriteData
        }
      }

      assets[type] = { catalog: manifest.catalog || [], sprites }
    } catch {
      // Skip furniture that fails to load
    }
  }

  return assets
}

/**
 * Load all assets needed for the Pixel Office
 */
export async function loadAllAssets(): Promise<boolean> {
  try {
    // Load characters (6 character sprites)
    const characters = await Promise.all(
      [0, 1, 2, 3, 4, 5].map((i) => loadCharacter(i))
    )
    setCharacterTemplates(characters)

    // Load floor tiles
    const floorSprites = await loadFloorSprites()
    setFloorSprites(floorSprites)

    // Load furniture
    const furnitureAssets = await loadFurnitureAssets()
    buildDynamicCatalog(furnitureAssets as any)

    return true
  } catch (err) {
    console.error('Failed to load office assets:', err)
    return false
  }
}
