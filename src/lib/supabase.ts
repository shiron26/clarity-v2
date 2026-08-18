import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import { authStorage } from './authStorage'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquantes — copier .env.example vers .env.local ' +
      '(stack locale : http://127.0.0.1:54321 + clé anon de `npx supabase status`).',
  )
}

// Même valeur que celle dérivée par supabase-js (`sb-<1er label d'hôte>-auth-token`),
// écrite en clair pour ne plus dépendre d'un détail d'implémentation. Garder l'hôte
// dans la clé sépare la session locale (`sb-127-auth-token`) de celle du hosted
// (`sb-<ref>-auth-token`) : une clé constante les ferait se marcher dessus en dev.
const storageKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`

export const supabase = createClient<Database>(url, anonKey, {
  // storage custom : porte le « Rester connecté » (localStorage vs sessionStorage).
  auth: { storage: authStorage, storageKey },
})
