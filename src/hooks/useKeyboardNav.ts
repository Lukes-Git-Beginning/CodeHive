import { useState, useEffect, useCallback } from 'react'

interface UseKeyboardNavOptions {
  onSelect?: (index: number) => void
  onBack?: () => void
  enabled?: boolean
}

export function useKeyboardNav(itemCount: number, options: UseKeyboardNavOptions = {}) {
  const { onSelect, onBack, enabled = true } = options
  const [selectedIndex, setSelectedIndex] = useState(-1)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled || itemCount === 0) return

      // Skip if user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((i) => Math.min(i + 1, itemCount - 1))
          break
        case 'k':
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((i) => Math.max(i - 1, 0))
          break
        case 'Enter':
          if (selectedIndex >= 0) {
            e.preventDefault()
            onSelect?.(selectedIndex)
          }
          break
        case 'Escape':
          if (onBack) {
            e.preventDefault()
            onBack()
          }
          break
        case 'g':
          // gg = go to top (simplified: single g)
          setSelectedIndex(0)
          break
        case 'G':
          setSelectedIndex(itemCount - 1)
          break
      }
    },
    [enabled, itemCount, selectedIndex, onSelect, onBack],
  )

  useEffect(() => {
    if (!enabled) return
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, handleKeyDown])

  // Reset when item count changes
  useEffect(() => {
    setSelectedIndex(-1)
  }, [itemCount])

  return { selectedIndex, setSelectedIndex }
}
