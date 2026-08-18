/// <reference types="vite/client" />
// Déclare le module virtuel `virtual:pwa-register/react` (hook useRegisterSW).
// Passe par une directive plutôt que par le tableau `types` de tsconfig.app.json :
// la référence reste locale à ce fichier et n'altère pas la config du projet.
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  // Dev uniquement (voir useProfile) : '1' force `onboarded_at` à null.
  readonly VITE_FORCE_ONBOARDING?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
