import { createRoot } from 'react-dom/client'
import { useState, useEffect, useRef } from 'react'
import './styles.css'

interface SelectionRect {
  startX: number
  startY: number
  endX: number
  endY: number
}

function AreaSelector() {
  const [isSelecting, setIsSelecting] = useState(false)
  const [selection, setSelection] = useState<SelectionRect | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setIsSelecting(true)
    setSelection({
      startX: x,
      startY: y,
      endX: x,
      endY: y
    })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isSelecting || !selection) return

    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setSelection({
      ...selection,
      endX: x,
      endY: y
    })
  }

  const handleMouseUp = async () => {
    if (!selection || !isSelecting) return

    setIsSelecting(false)

    // Calculate the final rectangle
    const x = Math.min(selection.startX, selection.endX)
    const y = Math.min(selection.startY, selection.endY)
    const width = Math.abs(selection.endX - selection.startX)
    const height = Math.abs(selection.endY - selection.startY)

    // Only complete if selection has meaningful size
    if (width > 10 && height > 10) {
      await window.electronAPI.completeAreaSelection({ x, y, width, height })
    } else {
      // Cancel if selection is too small
      await window.electronAPI.completeAreaSelection(null)
    }
  }

  const handleCancel = async () => {
    await window.electronAPI.completeAreaSelection(null)
  }

  // Handle Escape key to cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Calculate display rectangle
  const getDisplayRect = () => {
    if (!selection) return null
    const x = Math.min(selection.startX, selection.endX)
    const y = Math.min(selection.startY, selection.endY)
    const width = Math.abs(selection.endX - selection.startX)
    const height = Math.abs(selection.endY - selection.startY)
    return { x, y, width, height }
  }

  const displayRect = getDisplayRect()

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className="fixed inset-0 cursor-crosshair"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
      }}
    >
      {/* Instructions */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-lg text-sm">
        Drag to select an area • Press ESC to cancel
      </div>

      {/* Cancel button */}
      <button
        onClick={handleCancel}
        className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
      >
        Cancel
      </button>

      {/* Selection rectangle */}
      {displayRect && (
        <>
          {/* Border */}
          <div
            className="absolute border-2 border-blue-500 pointer-events-none"
            style={{
              left: `${displayRect.x}px`,
              top: `${displayRect.y}px`,
              width: `${displayRect.width}px`,
              height: `${displayRect.height}px`,
            }}
          />
          {/* Inner highlight */}
          <div
            className="absolute bg-blue-500/20 pointer-events-none"
            style={{
              left: `${displayRect.x}px`,
              top: `${displayRect.y}px`,
              width: `${displayRect.width}px`,
              height: `${displayRect.height}px`,
            }}
          />
          {/* Dimensions display */}
          <div
            className="absolute bg-black/80 text-white px-2 py-1 rounded text-xs pointer-events-none"
            style={{
              left: `${displayRect.x}px`,
              top: `${displayRect.y - 30}px`,
            }}
          >
            {Math.round(displayRect.width)} × {Math.round(displayRect.height)}
          </div>
        </>
      )}
    </div>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<AreaSelector />)
