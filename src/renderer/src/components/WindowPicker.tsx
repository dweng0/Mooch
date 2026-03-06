import type { WindowSource } from '../../../shared/types'
import { X } from 'lucide-react'

interface WindowPickerProps {
  windows: WindowSource[]
  onSelect: (sourceId: string) => void
  onCancel: () => void
}

export default function WindowPicker({ windows, onSelect, onCancel }: WindowPickerProps) {
  console.log(`[WindowPicker] Rendering with ${windows.length} windows`)

  if (windows.length === 0) {
    console.log('[WindowPicker] No windows available, showing empty state')
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-xl p-6 max-w-md mx-4">
          <h2 className="text-xl font-semibold text-white mb-3">No Windows Available</h2>
          <p className="text-gray-300 mb-4">
            No capturable windows were found. Please open an application window and try again.
          </p>
          <button
            onClick={() => {
              console.log('[WindowPicker] User clicked Cancel (no windows)')
              onCancel()
            }}
            className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 z-10 bg-gray-800 rounded-t-xl border-b border-white/10 p-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Select Window to Capture</h2>
          <button
            onClick={() => {
              console.log('[WindowPicker] User clicked Cancel button')
              onCancel()
            }}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            title="Cancel"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4">
          {windows.map((window, idx) => (
            <button
              key={window.id}
              onClick={() => {
                console.log(`[WindowPicker] User clicked window [${idx}]: id="${window.id}", name="${window.name}"`)
                onSelect(window.id)
              }}
              className="group relative bg-gray-900 rounded-lg overflow-hidden border-2 border-transparent hover:border-blue-500 transition-all duration-200 hover:scale-105"
            >
              <div className="aspect-video bg-gray-950 flex items-center justify-center">
                <img
                  src={`data:image/png;base64,${window.thumbnail}`}
                  alt={window.name}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="p-3 bg-gray-900 group-hover:bg-gray-800 transition-colors">
                <p className="text-sm text-gray-300 truncate" title={window.name}>
                  {window.name}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
