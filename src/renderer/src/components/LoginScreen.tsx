import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import StatusIndicator from './StatusIndicator'
import bunnyLogo from '../assets/bunny-logo.png'
import MochiLogo from './MochiLogo'

interface Props {
  apiUrl: string
}

export default function LoginScreen({ apiUrl }: Props) {
  const { t } = useTranslation('login')
  const [isWaitingForOAuth, setIsWaitingForOAuth] = useState(false)
  const [oauthProvider, setOauthProvider] = useState<string>('')

  // Listen for OAuth success and auth status updates
  useEffect(() => {
    const cleanupOAuthSuccess = window.electronAPI.onOAuthSuccess(() => {
      // OAuth success received via WebSocket
      setIsWaitingForOAuth(false)
    })

    const cleanupAuthStatus = window.electronAPI.onAuthStatusUpdate((status) => {
      if (status.loggedIn) {
        // Auth status updated (user is now logged in)
        setIsWaitingForOAuth(false)
      }
    })

    return () => {
      cleanupOAuthSuccess()
      cleanupAuthStatus()
    }
  }, [])

  const handleOAuthClick = (provider: 'google' | 'github' | 'discord') => {
    setOauthProvider(provider)
    setIsWaitingForOAuth(true)
    window.electronAPI.openOAuth(provider)
  }

  const handleCancel = () => {
    setIsWaitingForOAuth(false)
    setOauthProvider('')
  }

  return (
    <div className="h-full flex flex-col bg-gray-900/85 rounded-2xl backdrop-blur-sm border border-white/10 overflow-hidden shadow-2xl">
      {/* Title bar */}
      <div className="drag-region px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="no-drag">
            {apiUrl && <StatusIndicator apiUrl={apiUrl} />}
          </div>
          <h1 className="text-sm font-semibold text-white flex-1 text-center">{t('app.title', { ns: 'app' })}</h1>
          <div className="no-drag">
            <img src={bunnyLogo} alt={t('app.title', { ns: 'app' })} className="h-8 w-8" />
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center px-6 py-4">
        <div className="flex justify-center mb-6">
          <MochiLogo className="h-32 w-32" />
        </div>

        {isWaitingForOAuth ? (
          // Waiting for OAuth completion state
          <div className="text-center">
            <div className="mb-6">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">
              Completing Sign In...
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              Please complete the sign-in process in your browser.
            </p>
            <p className="text-xs text-gray-500 mb-6">
              Once you've signed in, this window will update automatically.
            </p>
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          // Normal login screen
          <>
            <p className="text-xs text-gray-400 text-center mb-4">
              {t('heading')}
            </p>

            <div className="mt-2 w-full">
              <div className="relative flex items-center justify-center">
                <div className="flex-grow border-t border-gray-700"></div>
                <span className="mx-4 text-xs text-gray-500">CONTINUE WITH</span>
                <div className="flex-grow border-t border-gray-700"></div>
              </div>

              <div className="flex justify-center gap-3 mt-4 space-y-3">
                <button
                  onClick={() => handleOAuthClick('google')}
                  className="flex items-center justify-center w-12 h-12 rounded-full bg-white hover:bg-gray-100 transition-colors border border-gray-300"
                  title="Sign in with Google"
                >
                  {/* Google "G" logo */}
                  <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                </button>

                <button
                  onClick={() => handleOAuthClick('github')}
                  className="flex items-center justify-center w-12 h-12 rounded-full bg-black hover:bg-gray-800 transition-colors text-white"
                  title="Sign in with GitHub"
                >
                  {/* GitHub logo */}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                  </svg>
                </button>

                <button
                  onClick={() => handleOAuthClick('discord')}
                  className="flex items-center justify-center w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-700 transition-colors text-white"
                  title="Sign in with Discord"
                >
                  {/* Discord logo */}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                </button>
              </div>
            </div>

            <p className="text-[10px] text-gray-500 text-center mt-6">
              Authentication is securely handled through your chosen provider.
            </p>
            <p className="text-[10px] text-white/60 text-center mt-2">
              By using the app you agree to our{' '}
              <a
                href="https://mooch.run/terms"
                onClick={(e) => { e.preventDefault(); window.electronAPI.openExternalUrl('https://mooch.run/terms') }}
                className="underline hover:text-white transition-colors cursor-pointer"
              >
                terms of service
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
