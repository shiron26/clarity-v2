import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/database'
import { LOCAL_ANON_KEY, LOCAL_SUPABASE_URL } from '../local'

export type TestAccount = {
  email: string
  password: string
  session: Session
  userId: string
  /** Client authentifié — sert à préparer les données par l'API, hors navigateur. */
  client: SupabaseClient<Database>
}

// 12 caractères : `minimum_password_length` vaut 6 en local, mais SignupPage impose
// `minLength={8}` côté client. Le même mot de passe partout permet au test de
// connexion de rejouer le vrai formulaire.
export const TEST_PASSWORD = 'e2e-Passw0rd!'

/**
 * Retente une écriture PostgREST tant qu'elle échoue en PGRST301.
 *
 * Juste après un signup, GoTrue signe un token dont l'`iat` est l'instant présent
 * tronqué à la seconde ; si l'horloge du vérifieur retarde marginalement, PostgREST
 * rejette les toutes premières requêtes en « JWT issued at future » pendant ~1 s.
 * `src/lib/queryClient.ts` absorbe ce cas côté navigateur, mais le client Node de la
 * fixture n'a pas ce filet : sans lui, la fixture échoue par intermittence et on
 * conclut à tort que Playwright est instable.
 *
 * Ne JAMAIS répondre à un PGRST301 par un `refreshSession()` : le token est déjà
 * frais, en redemander un minte un `iat` encore plus « futur ».
 */
async function withAuthRetry<T extends { error: { code?: string } | null }>(
  run: () => PromiseLike<T>,
): Promise<T> {
  const delays = [150, 400, 900, 1_200] // mêmes valeurs que queryClient.ts
  for (let attempt = 0; ; attempt++) {
    const result = await run()
    if (!result.error) return result
    if (result.error.code !== 'PGRST301' || attempt >= delays.length) return result
    await new Promise((resolve) => setTimeout(resolve, delays[attempt]))
  }
}

/**
 * Crée un compte de test neuf et rend de quoi piloter l'API en son nom.
 *
 * `onboarded: true` reproduit LITTÉRALEMENT ce que fait
 * `src/features/onboarding/useCompleteOnboarding.ts` quand l'utilisateur clique
 * « Entrer dans Clarity ». Ce n'est pas un contournement : la migration 0011 pose un
 * `grant update (onboarded_at)` explicite, et sans cette écriture l'overlay opaque
 * d'onboarding bloque le dashboard pour tous les tests.
 */
export async function createTestAccount(
  options: { onboarded?: boolean } = {},
): Promise<TestAccount> {
  const client = createClient<Database>(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
    // Pas de persistance : ce client vit le temps d'un worker et ne doit rien écrire
    // sur disque ni rafraîchir un token en arrière-plan pendant les tests.
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Le préfixe `e2e+` rend tout le bruit de test repérable dans Studio par un simple
  // `where email like 'e2e+%'`, ce qui tient lieu de nettoyage à la demande.
  const email = `e2e+${crypto.randomUUID()}@clarity.test`

  const { data, error } = await client.auth.signUp({
    email,
    password: TEST_PASSWORD,
    options: { data: { display_name: 'Camille E2E' } },
  })
  if (error) throw new Error(`signUp e2e a échoué : ${error.message}`)

  const session = data.session
  if (!session) {
    throw new Error(
      'signUp n’a pas rendu de session. La stack visée n’est pas la stack locale : ' +
        'seul le local a `[auth.email] enable_confirmations = false` (supabase/config.toml).',
    )
  }

  if (options.onboarded ?? true) {
    const { error: profileError } = await withAuthRetry(() =>
      client
        .from('profile')
        .update({ onboarded_at: new Date().toISOString() })
        .eq('id', session.user.id),
    )
    if (profileError) {
      throw new Error(`Impossible de marquer l’onboarding comme vu : ${profileError.message}`)
    }
  }

  return { email, password: TEST_PASSWORD, session, userId: session.user.id, client }
}
