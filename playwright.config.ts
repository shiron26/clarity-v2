import { defineConfig, devices } from '@playwright/test'
import { APP_URL, LOCAL_ANON_KEY, LOCAL_SUPABASE_URL } from './e2e/local'

// L'import ci-dessus n'est pas qu'une commodité : `e2e/local.ts` lève à l'import si
// l'une de ses URL n'est pas locale. Le garde-fou s'exécute donc avant le premier test.

export default defineConfig({
  testDir: './e2e/specs',
  globalSetup: './e2e/globalSetup.ts',
  fullyParallel: true,

  // Un `test.only` oublié ferait passer le job au vert en n'exécutant qu'un test.
  forbidOnly: !!process.env.CI,

  // 0 en local, délibérément : un test qui ne passe qu'à la seconde tentative est
  // cassé, et il faut le voir. En CI, un seul essai de rattrapage absorbe l'aléa
  // d'infrastructure (runner lent, premier chargement Vite) sans transformer les
  // retries en permission d'écrire des tests instables.
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,

  reporter: process.env.CI ? [['html'], ['github']] : [['html', { open: 'never' }]],

  // 7 s et non 5 : juste après une connexion, PostgREST rejette pendant ~1 s un JWT
  // dont l'`iat` est « dans le futur » (voir AGENTS.md). `src/lib/queryClient.ts` le
  // retente jusqu'à ~2,65 s ; le défaut rendrait le premier écran de chaque test
  // intermittent.
  expect: { timeout: 7_000 },

  use: {
    baseURL: APP_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Volontairement PAS de `reducedMotion: 'reduce'`, alors que c'est la recette
    // habituelle pour accélérer une suite : `useDoneSequence` sort immédiatement sous
    // mouvement réduit, donc ni le flash de la ligne cochée ni le « pop » de la carte
    // d'objectif ne se produisent. On testerait un autre produit que celui qu'on livre.
    // L'auto-waiting suffit largement à absorber les ~1,7 s d'animation.
  },

  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      grepInvert: /@mobile/,
    },
    {
      // Pixel 5 : 393 px de large, donc sous le point de rupture `lg` de Tailwind —
      // l'app rend son arbre mobile, pas seulement un autre CSS.
      name: 'mobile',
      use: { ...devices['Pixel 5'] },
      grep: /@mobile/,
    },
  ],

  webServer: {
    // `--strictPort` : sans lui, Vite bascule sur 5174 si 5173 est occupé et les tests
    // parlent silencieusement à une autre instance que `baseURL`.
    command: 'npm run dev -- --port 5173 --strictPort --host 127.0.0.1',
    url: APP_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,

    // Ces trois valeurs ÉCRASENT tout fichier .env : dans Vite, `process.env` est
    // appliqué après le parsing des fichiers (dernière boucle de `loadEnv`). C'est ce
    // qui rend structurellement impossible qu'un test vise le hosted — `.env.local`
    // est chargé dans tous les modes, et il pointe là-bas.
    env: {
      VITE_SUPABASE_URL: LOCAL_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: LOCAL_ANON_KEY,
      // `useProfile` force `onboarded_at: null` quand ce drapeau vaut '1' en dev :
      // le laisser à la main d'un fichier local bloquerait toute la suite derrière
      // l'overlay d'onboarding.
      VITE_FORCE_ONBOARDING: '0',
    },
  },
})
