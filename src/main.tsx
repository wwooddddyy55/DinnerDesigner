import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App.tsx'
import { applyThemePreference, getThemePreference } from './lib/theme'

// Before the first render, so a dark-theme user never sees a light flash.
applyThemePreference(getThemePreference())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
