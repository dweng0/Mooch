interface ContextPanelProps {
  cvName: string
  jobDescName: string
  manualContext: string
  onLoadCV: () => void
  onLoadJobDesc: () => void
  onClearCV: () => void
  onClearJobDesc: () => void
  onManualContextChange: (value: string) => void
}

export default function ContextPanel({
  cvName,
  jobDescName,
  manualContext,
  onLoadCV,
  onLoadJobDesc,
  onClearCV,
  onClearJobDesc,
  onManualContextChange
}: ContextPanelProps) {
  return (
    <div className="px-4 py-3 border-b border-white/10 flex flex-col gap-2">
      <h2 className="text-xs font-semibold text-gray-400">User Input</h2>
      <div className="flex gap-2">
        <ContextButton
          label="CV / Resume"
          fileName={cvName}
          onLoad={onLoadCV}
          onClear={onClearCV}
        />
        <ContextButton
          label="Job Description"
          fileName={jobDescName}
          onLoad={onLoadJobDesc}
          onClear={onClearJobDesc}
        />
      </div>
      <input
        type="text"
        value={manualContext}
        onChange={(e) => onManualContextChange(e.target.value)}
        placeholder="Add context (e.g., 'This is an interview about TypeScript')"
        className="w-full bg-gray-800 text-gray-300 text-xs rounded-lg px-3 py-2 border border-white/10 outline-none focus:border-blue-500 placeholder-gray-500"
      />
    </div>
  )
}

function ContextButton({
  label,
  fileName,
  onLoad,
  onClear
}: {
  label: string
  fileName: string
  onLoad: () => void
  onClear: () => void
}) {
  if (fileName) {
    return (
      <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-lg px-2.5 py-1.5 text-xs">
        <span className="text-emerald-400 truncate max-w-[120px]" title={fileName}>
          {fileName}
        </span>
        <button
          onClick={onClear}
          className="text-gray-400 hover:text-red-400 transition-colors ml-1 cursor-pointer"
          title={`Remove ${label}`}
        >
          x
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={onLoad}
      className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
    >
      + {label}
    </button>
  )
}
