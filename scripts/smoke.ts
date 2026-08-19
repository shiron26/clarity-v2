// Smoke test bout en bout via PostgREST (supabase-js), côté client réel.
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... npm run smoke
// Sans variables d'env, lit VITE_* / SUPABASE_SERVICE_ROLE_KEY dans .env.local.
// Sur le hosted : préférer SUPABASE_SERVICE_ROLE_KEY (admin.createUser) pour
// éviter rate-limit email + validation DNS. Crée deux comptes jetables, vérifie
// CRUD via les vues, isolation et Realtime. Idempotent (données horodatées).

import { readFileSync } from 'node:fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function readDotenv(name: string): string | undefined {
  try {
    const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    const line = raw.split('\n').find((l) => l.startsWith(`${name}=`))
    if (line) return line.slice(name.length + 1).trim()
  } catch {
    /* pas de .env.local */
  }
  return undefined
}

function envOrDotenv(name: string, dotenvName: string): string {
  const v = process.env[name] ?? readDotenv(dotenvName)
  if (!v) throw new Error(`${name} manquant (env ou .env.local)`)
  return v
}

// Comparaison exacte sur le hostname (pas un test de sous-chaîne sur l'URL
// entière) : `https://localhost.attacker.tld` ne doit PAS passer pour local.
function isLocalUrl(u: string): boolean {
  let hostname: string
  try {
    hostname = new URL(u).hostname
  } catch {
    return false // URL invalide → jamais considérée locale (échec fermé)
  }
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

const URL_ = envOrDotenv('SUPABASE_URL', 'VITE_SUPABASE_URL')
const ANON = envOrDotenv('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY')
// Service role : contourne rate-limit email + validation DNS du hosted (jamais exposé au front).
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? readDotenv('SUPABASE_SERVICE_ROLE_KEY')

const IS_LOCAL = isLocalUrl(URL_)

// Le smoke crée des comptes : sur le hosted il touche des données réelles, et sans
// SUPABASE_URL explicite il lit .env.local, donc il vise le hosted par défaut. Opt-in
// obligatoire — c'est la garde côté script du garde-fou .claude/hooks/block-hosted-supabase.sh.
if (!IS_LOCAL && process.env.CLARITY_ALLOW_HOSTED !== '1') {
  throw new Error(
    `Refus de lancer le smoke contre le hosted (${URL_}) : il y crée des comptes.\n` +
      '  → Stack locale : SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=… npm run smoke\n' +
      '  → Hosted, en connaissance de cause (utilisateur uniquement) : CLARITY_ALLOW_HOSTED=1 npm run smoke',
  )
}

// En local, `signUp` suffit : les confirmations email sont désactivées
// (supabase/config.toml, [auth.email] enable_confirmations = false) et la session
// arrive immédiatement. Sur le hosted elles sont actives : `signUp` renvoie un
// user sans session, et tout ce qui suit tombe sur du null. On refuse de partir
// plutôt que d'échouer trente lignes plus loin sur un symptôme illisible.
if (!IS_LOCAL && !SERVICE) {
  throw new Error(
    `SUPABASE_SERVICE_ROLE_KEY manquante — obligatoire pour lancer le smoke contre le hosted (${URL_}).\n` +
      "  Sans elle, le smoke passe par signUp ; le hosted exige la confirmation email et ne rend donc\n" +
      '  aucune session, ce qui rend le test impossible.\n' +
      '  → Dashboard Supabase → Project Settings → API → service_role, à poser dans .env.local.\n' +
      '  → Ou viser la stack locale : SUPABASE_URL=http://127.0.0.1:54321 npm run smoke',
  )
}

let failures = 0
function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) {
    console.log(`  OK: ${label}`)
  } else {
    failures++
    console.error(`  FAIL: ${label}`, detail ?? '')
  }
}

async function newUser(tag: string): Promise<SupabaseClient> {
  const password = 'smoke-Passw0rd!'
  // Domaine avec MX réel : GoTrue hosted rejette .local / example.com (validation DNS).
  const email = `smoke.${tag}.${Date.now()}@gmail.com`
  const client = createClient(URL_, ANON, { auth: { persistSession: false } })

  if (SERVICE) {
    const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } })
    const { error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (createErr) throw new Error(`admin.createUser ${tag}: ${createErr.message}`)
    const { error: signErr } = await client.auth.signInWithPassword({ email, password })
    if (signErr) throw new Error(`signIn ${tag}: ${signErr.message}`)
    return client
  }

  const { data, error } = await client.auth.signUp({ email, password })
  if (error) throw new Error(`signUp ${tag}: ${error.message}`)
  // Pas de session = confirmation email exigée : le compte existe mais n'est pas
  // utilisable. Échouer ici, là où la cause est lisible.
  if (!data.session) {
    throw new Error(
      `signUp ${tag}: aucune session rendue (confirmation email exigée par ${URL_}).\n` +
        '  Poser SUPABASE_SERVICE_ROLE_KEY dans .env.local pour créer les comptes en admin.',
    )
  }
  return client
}

async function main() {
  console.log(`Smoke test contre ${URL_}`)
  const a = await newUser('a')
  const b = await newUser('b')
  const anon = createClient(URL_, ANON, { auth: { persistSession: false } })
  const { data: userA } = await a.auth.getUser()
  const uidA = userA.user!.id

  // --- anon : aucun accès
  const anonRead = await anon.from('task').select('id')
  check('anon ne lit pas les tâches', anonRead.error !== null)

  // --- CRUD perso via la vue task (colonnes en clair)
  const ins = await a
    .from('task')
    .insert({ user_id: uidA, title: 'tâche smoke', description: 'secret' })
    .select()
    .single()
  check('A crée une tâche (title en clair via la vue)', ins.data?.title === 'tâche smoke', ins.error)
  const taskId = ins.data?.id

  const upd = await a
    .from('task')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', taskId)
    .select()
    .single()
  check('A coche sa tâche, completed_by posé par le serveur', upd.data?.completed_by === uidA, upd.error)

  // --- isolation : B ne voit rien
  const bRead = await b.from('task').select('id')
  check('B ne voit aucune tâche de A', bRead.data?.length === 0, bRead.error)

  const forge = await b.from('task').insert({ user_id: uidA, title: 'intrusion' })
  check('B ne peut pas écrire au nom de A', forge.error !== null)

  // --- espace + review + realtime
  const spaceIns = await a.from('space').insert({ name: 'espace smoke' }).select().single()
  check('A crée un espace', spaceIns.data?.name === 'espace smoke', spaceIns.error)
  const spaceId = spaceIns.data?.id

  const bSpace = await b.from('space').select('id')
  check("B (non membre) ne voit pas l'espace", bSpace.data?.length === 0, bSpace.error)

  const review = await a
    .from('review')
    .insert({ period_type: 'week', period_year: 2099, period_index: 1, space_id: spaceId })
    .select()
    .single()
  check("A démarre une session de review d'espace", !!review.data?.id, review.error)

  // Realtime : A écoute le curseur partagé puis le déplace
  const cursorMoved = new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), 15000)
    const channel = a
      .channel(`review-session-${review.data!.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'review', filter: `id=eq.${review.data!.id}` },
        () => {
          clearTimeout(timer)
          void a.removeChannel(channel)
          resolve(true)
        },
      )
      .subscribe(async (status, err) => {
        if (status === 'SUBSCRIBED') {
          // marge plus large : le hosted peut mettre >1s à brancher le WAL
          await new Promise((r) => setTimeout(r, 2500))
          const updReview = await a
            .from('review')
            .update({ validated_at: new Date().toISOString() })
            .eq('id', review.data!.id)
            .select('id')
            .single()
          if (updReview.error) {
            clearTimeout(timer)
            void a.removeChannel(channel)
            console.error('  Realtime setup: update review failed', updReview.error)
            resolve(false)
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timer)
          void a.removeChannel(channel)
          console.error('  Realtime setup: channel', status, err)
          resolve(false)
        }
      })
  })
  check('Realtime : signal reçu sur la review (signal only, payload ignoré)', await cursorMoved)

  // --- RPC report en masse
  const rpc = await a.rpc('postpone_overdue_tasks')
  check('RPC postpone_overdue_tasks répond', rpc.error === null, rpc.error)

  console.log(failures === 0 ? '\nSmoke test : tout est vert.' : `\nSmoke test : ${failures} échec(s).`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('Smoke test interrompu :', e)
  process.exit(1)
})
