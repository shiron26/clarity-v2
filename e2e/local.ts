// La cible des tests E2E : la stack Supabase LOCALE, et rien d'autre.
//
// Ce fichier est versionné, valeurs comprises. Ce n'est pas une entorse à la règle
// « pas de secret dans le dépôt » : la clé ci-dessous est le JWT de démonstration
// que le CLI Supabase pose sur TOUTE stack locale, identique chez tout le monde,
// imprimé par `npx supabase status` et publié dans la documentation. Son `iss` est
// `supabase-demo`, son seul pouvoir est le rôle `anon` — entièrement soumis à la
// RLS — et elle ne vaut que face à un Postgres tournant sur 127.0.0.1 de la machine
// qui la lit.
//
// Ce qui doit rester secret, c'est `.env.local` (URL hosted + clés réelles). Aucun
// test ne le lit, et aucun secret GitHub n'est nécessaire au workflow : si `e2e.yml`
// finit par référencer `secrets.*`, c'est que quelque chose a dérapé.

export const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'

export const LOCAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

// 127.0.0.1 et JAMAIS localhost, partout — y compris ici, dans `webServer.url` et
// dans `baseURL`. localStorage est cloisonné par origine : mélanger les deux ferait
// perdre la session injectée par la fixture, sans le moindre message d'erreur.
export const APP_URL = 'http://127.0.0.1:5173'

// Dérivée dans src/lib/supabase.ts par `sb-${hostname.split('.')[0]}-auth-token`.
// Avec l'URL ci-dessus, le hostname est `127.0.0.1` → `sb-127-auth-token`.
export const AUTH_STORAGE_KEY = 'sb-127-auth-token'

// Le conteneur Postgres de la stack locale (`supabase start`), nommé d'après le
// `project_id` de supabase/config.toml. Sert au helper SQL — voir helpers/sqlLocal.ts.
export const LOCAL_DB_CONTAINER = 'supabase_db_clarity-v2'

/**
 * Comparaison du hostname EXACT, échec fermé — même patron que `scripts/smoke.ts`
 * et `scripts/seed-dev.ts`. Le test d'égalité protège de `https://localhost.attacker.tld`,
 * qu'un `includes('localhost')` laisserait passer ; le `catch` refuse une URL illisible
 * plutôt que de la supposer inoffensive.
 */
export function isLocalUrl(url: string): boolean {
  let hostname: string
  try {
    hostname = new URL(url).hostname
  } catch {
    return false
  }
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

// Évalué à l'import de playwright.config.ts, donc AVANT le premier test : la suite
// ne peut pas démarrer si quelqu'un pointe ces constantes ailleurs. Le projet hosted
// porte des comptes réels et les tests y créeraient des comptes — d'où l'échec fermé
// plutôt qu'un avertissement.
if (!isLocalUrl(LOCAL_SUPABASE_URL) || !isLocalUrl(APP_URL)) {
  throw new Error(
    'Les tests E2E ne visent QUE la stack Supabase locale. URL non locale détectée dans e2e/local.ts.',
  )
}
