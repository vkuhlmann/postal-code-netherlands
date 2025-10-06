import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './vite/App'
import './app/globals.css'
import { registerSW } from 'virtual:pwa-register'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Register the service worker for PWA
registerSW({ immediate: true })
