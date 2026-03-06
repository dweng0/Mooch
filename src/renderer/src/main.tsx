import React from 'react'
import ReactDOM from 'react-dom/client'
import './i18n' // Initialize i18n
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import './styles.css'

// Catch unhandled promise rejections to prevent app crashes
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason)
  event.preventDefault() // Prevent default crash behavior
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
