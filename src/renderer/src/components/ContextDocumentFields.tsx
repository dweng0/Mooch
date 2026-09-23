import { useState } from 'react'
import { FileText, X } from 'lucide-react'

interface FieldProps {
  /** Current text of the document. */
  value: string
  /** File name the text was loaded from, or '' when typed or pasted. */
  fileName: string
  /** Called with the new text and its file name ('' when not from a file). */
  onChange: (text: string, fileName: string) => void
}

/** Strips Electron's IPC wrapper from an error so only the handler's message is shown. */
function ipcErrorMessage(err: unknown): string {
  return err instanceof Error
    ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
    : String(err)
}

/** Shared layout: a file chip or load button above a free-text box. */
function DocumentField({
  label,
  value,
  fileName,
  onChange,
  loadLabel,
  clearTitle,
  defaultName,
  placeholder,
  onPaste,
  busy = false,
  error = '',
}: FieldProps & {
  label: string
  loadLabel: string
  clearTitle: string
  defaultName: string
  placeholder: string
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void
  busy?: boolean
  error?: string
}) {
  const handleLoad = async () => {
    const result = await window.electronAPI.loadTextFile()
    if (result) onChange(result.content, result.name)
  }

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{label}</label>
      {value ? (
        <div className="flex items-center justify-between bg-emerald-500/15 border border-emerald-500/30 rounded-lg px-3 py-2.5 mb-3">
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <FileText size={14} />
            <span className="truncate max-w-[200px]">{fileName || defaultName}</span>
          </div>
          <button
            onClick={() => onChange('', '')}
            className="text-gray-400 hover:text-red-400 transition-colors cursor-pointer ml-2"
            title={clearTitle}
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          onClick={handleLoad}
          className="w-full flex items-center gap-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg px-3 py-2.5 text-xs text-gray-500 hover:text-gray-900 transition-colors cursor-pointer mb-3"
        >
          <FileText size={14} />
          {loadLabel}
        </button>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value, fileName)}
        onPaste={onPaste}
        disabled={busy}
        className="w-full h-28 bg-gray-100 border border-gray-200 rounded-lg p-3 text-gray-900 text-sm focus:outline-none focus:border-blue-500 placeholder-gray-400"
        placeholder={placeholder}
      />
      {error && (
        <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-2 text-red-600 text-xs">{error}</div>
      )}
    </div>
  )
}

/** Resume / CV input: load a .txt/.pdf/.docx file or paste the text. */
export function ResumeField(props: FieldProps) {
  return (
    <DocumentField
      {...props}
      label="Resume / CV"
      loadLabel="Load resume file (.txt, .pdf, .docx)"
      clearTitle="Clear resume"
      defaultName="resume"
      placeholder="Or paste your resume..."
    />
  )
}

/** Job description input: load a file, paste the text, or paste a link to the posting. */
export function JobDescriptionField(props: FieldProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  /** When the pasted text is just a link, fetch the posting and fill the box with it. */
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData('text').trim()
    if (!/^https?:\/\/\S+$/.test(pasted)) return
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      props.onChange(await window.electronAPI.fetchJobUrl(pasted), '')
    } catch (err) {
      setError(ipcErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <DocumentField
      {...props}
      onChange={(text, name) => { setError(''); props.onChange(text, name) }}
      label="Job Description"
      loadLabel="Load job description file"
      clearTitle="Clear job description"
      defaultName="job description"
      placeholder={loading ? 'Fetching job posting...' : 'Or paste the job description (or a link to it)...'}
      onPaste={handlePaste}
      busy={loading}
      error={error}
    />
  )
}
