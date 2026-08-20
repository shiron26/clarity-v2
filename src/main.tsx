import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { installAppLifecycle } from './lib/appLifecycle'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './features/auth/AuthProvider'
import App from './App.tsx'
import './index.css'

// Safari ignore `user-scalable=no` en onglet : le pincement ne se coupe que par ses
// événements de geste propriétaires. `{ passive: false }` est indispensable — sans lui
// le `preventDefault()` est ignoré. Sans effet ailleurs : aucun autre moteur n'émet
// `gesture*`.
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (event) => event.preventDefault(), { passive: false })
}

// Le réveil de l'onglet est un moment de la vie de l'application, pas un
// accident qui arrive à huit queries : la session se remet en état AVANT que la
// resynchronisation ne parte. Posé ici, hors de React, comme `queryClient`.
installAppLifecycle()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
