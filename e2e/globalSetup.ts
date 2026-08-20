import { LOCAL_SUPABASE_URL, LOCAL_ANON_KEY } from './local'

/**
 * Une stack Supabase arrêtée est LE cas de figure le plus fréquent quand on lance la
 * suite, et sans ce garde il produit vingt-cinq timeouts de trente secondes et un
 * rapport illisible. Un seul appel avant le premier test rend le diagnostic immédiat.
 */
export default async function globalSetup(): Promise<void> {
  try {
    const response = await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: LOCAL_ANON_KEY },
      signal: AbortSignal.timeout(5_000),
    })
    // PostgREST rend 200 sur sa racine ; tout autre code signale une stack à moitié
    // levée, ce qui est aussi bloquant qu'une stack éteinte.
    if (!response.ok) {
      throw new Error(`PostgREST a répondu ${response.status}`)
    }
  } catch (cause) {
    throw new Error(
      `Stack Supabase locale injoignable sur ${LOCAL_SUPABASE_URL}.\n` +
        'Lancer `npx supabase start`, puis relancer `npm run test:e2e`.\n' +
        `Cause : ${cause instanceof Error ? cause.message : String(cause)}`,
    )
  }
}
