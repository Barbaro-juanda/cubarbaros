import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import '@fontsource/pirata-one/400.css'
import './index.css'
import App from './App'
import { iniciarSincronizacion } from './datos/sync'

registerSW({ immediate: true })
iniciarSincronizacion()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
