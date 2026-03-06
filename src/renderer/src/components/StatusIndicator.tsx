import { useEffect, useState } from 'react'

type HealthStatus = 'checking' | 'healthy' | 'unhealthy'

interface Props {
  apiUrl: string
}

const DISCONNECTED_INTERVAL_MS = 30_000
const CONNECTED_INITIAL_MS = 60_000
const CONNECTED_MAX_MS = 60 * 60_000 // 1 hour

export default function StatusIndicator({ apiUrl }: Props) {
  const [status, setStatus] = useState<HealthStatus>('checking')

  useEffect(() => {
    let abortController: AbortController | null = null
    let fetchTimeoutId: NodeJS.Timeout | null = null
    let nextCheckId: NodeJS.Timeout | null = null
    let connectedInterval = CONNECTED_INITIAL_MS

    const scheduleNext = (wasHealthy: boolean) => {
      if (wasHealthy) {
        console.log(`[StatusIndicator] Next check in ${connectedInterval / 1000}s (connected backoff)`)
        nextCheckId = setTimeout(checkHealth, connectedInterval)
        connectedInterval = Math.min(connectedInterval * 2, CONNECTED_MAX_MS)
      } else {
        connectedInterval = CONNECTED_INITIAL_MS
        console.log(`[StatusIndicator] Next check in ${DISCONNECTED_INTERVAL_MS / 1000}s (disconnected)`)
        nextCheckId = setTimeout(checkHealth, DISCONNECTED_INTERVAL_MS)
      }
    }

    const checkHealth = async () => {
      abortController = new AbortController()
      setStatus('checking')

      const healthUrl = `${apiUrl}/api/health`
      console.log('[StatusIndicator] Checking health:', healthUrl)

      // Set a 10-second timeout
      fetchTimeoutId = setTimeout(() => {
        abortController?.abort()
        console.log('[StatusIndicator] Health check timed out after 10s:', healthUrl)
        setStatus('unhealthy')
        scheduleNext(false)
      }, 10000)

      try {
        const response = await fetch(healthUrl, {
          method: 'GET',
          signal: abortController.signal,
        })

        if (fetchTimeoutId) clearTimeout(fetchTimeoutId)

        console.log('[StatusIndicator] Health response:', response.status, response.statusText)

        if (response.ok) {
          const body = await response.text().catch(() => '<unreadable>')
          console.log('[StatusIndicator] Health body:', body)
          setStatus('healthy')
          scheduleNext(true)
        } else {
          const body = await response.text().catch(() => '<unreadable>')
          console.warn('[StatusIndicator] Health check failed — status:', response.status, 'body:', body)
          setStatus('unhealthy')
          scheduleNext(false)
        }
      } catch (err) {
        if (fetchTimeoutId) clearTimeout(fetchTimeoutId)
        // Only set to unhealthy if it wasn't an abort
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('[StatusIndicator] Health check error:', err.name, err.message)
          setStatus('unhealthy')
          scheduleNext(false)
        } else {
          console.log('[StatusIndicator] Health check aborted (expected on cleanup)')
        }
      }
    }

    // Check immediately on mount
    checkHealth()

    return () => {
      if (abortController) abortController.abort()
      if (fetchTimeoutId) clearTimeout(fetchTimeoutId)
      if (nextCheckId) clearTimeout(nextCheckId)
    }
  }, [apiUrl])

  const getStatusColor = () => {
    switch (status) {
      case 'checking':
        return 'bg-orange-500'
      case 'healthy':
        return 'bg-green-500'
      case 'unhealthy':
        return 'bg-red-500'
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'checking':
        return 'Connecting...'
      case 'healthy':
        return 'Connected'
      case 'unhealthy':
        return 'Disconnected'
    }
  }

  return (
    <div className="flex items-center gap-2" title={getStatusText()}>
      <div className={`w-2 h-2 rounded-full ${getStatusColor()} transition-colors duration-300`} />
      <span className="text-xs text-gray-500">{getStatusText()}</span>
    </div>
  )
}
