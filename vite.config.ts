import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt' : le nouveau service worker reste en attente et ne prend la main
      // que sur décision de l'utilisateur (UpdateBanner) — jamais de rechargement
      // surprise en pleine saisie.
      registerType: 'prompt',
      // L'enregistrement est fait par UpdateBanner via `virtual:pwa-register/react` ;
      // laisser le plugin injecter le sien en plus donnerait un double register.
      injectRegister: null,
      // Ni `includeAssets`, ni `includeManifestIcons` (défaut `true`) : les deux
      // poussent des fichiers dans les additionalManifestEntries du plugin, alors
      // que le `globPatterns` ci-dessous ramasse déjà tout le svg/png de dist/.
      // Les cumuler donne deux entrées de précache pour le même fichier — vérifié.
      includeManifestIcons: false,
      manifest: {
        // Identité stable de l'app installée, indépendante de start_url.
        id: '/',
        name: 'Clarity',
        short_name: 'Clarity',
        description: 'Vos tâches et vos objectifs, au même endroit.',
        lang: 'fr',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // = --color-canvas : même peinture que <body>, l'écran de démarrage ne
        // flashe pas au lancement. L'app n'a ni en-tête coloré ni dark mode, donc
        // une seule valeur de theme_color suffit.
        background_color: '#f7f6f3',
        theme_color: '#f7f6f3',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          { name: 'Tâches', url: '/taches' },
          { name: 'Revue', url: '/review' },
        ],
      },
      workbox: {
        // `woff2` est absent du glob par défaut : sans lui, Sora n'est pas précachée
        // et la coquille hors ligne perd sa typographie. `webmanifest` en revanche
        // n'a rien à y faire — le plugin l'ajoute déjà en additionalManifestEntries.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // SPA : toute navigation retombe sur l'index précaché.
        navigateFallback: '/index.html',
        // Aucune route de l'app ne contient de point : ce qui y ressemble est un
        // fichier, et servir index.html à sa place masquerait un asset manquant.
        navigateFallbackDenylist: [/\/[^/?]+\.[^/?]*$/],
        cleanupOutdatedCaches: true,
        // Cohérent avec registerType 'prompt' : le SW installé attend en `waiting`
        // jusqu'à updateServiceWorker().
        skipWaiting: false,
        clientsClaim: false,
        // Volontairement AUCUN runtimeCaching. Les vues `public.*` renvoient du clair
        // déchiffré : mettre une réponse PostgREST en Cache Storage écrirait des
        // données sensibles sur le disque et annulerait le chiffrement en base.
        // Sans règle runtime, les appels cross-origin (REST + websocket Realtime)
        // traversent le service worker sans être interceptés.
      },
      // Le SW n'est servi qu'en build : tout test PWA passe par `npm run preview`.
      devOptions: { enabled: false },
    }),
  ],
})
