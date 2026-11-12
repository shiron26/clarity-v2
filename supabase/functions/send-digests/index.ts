// « Ma journée » (SPEC-MA-JOURNEE §5) : envoi des résumés quotidiens en Web Push.
//
// Deux modes, une seule fonction :
//   · cron : pg_cron → pg_net, en-tête `x-cron-secret` (comparé à CRON_SECRET).
//     Réclame les résumés dus (`claim_due_digests`, qui marque `last_sent_on`
//     AVANT l'envoi : jamais deux résumés le même jour) et les pousse.
//   · test : appel de l'utilisateur avec son JWT et `{ "test": true }`. Pousse
//     le résumé du jour à SES appareils, sans toucher à `last_sent_on`.
//
// `verify_jwt = false` (config.toml) : le cron n'a pas de JWT, la fonction
// vérifie donc elle-même le secret ou le jeton.
//
// Rien de ce qui passe ici n'est journalisé en clair : ni le corps des résumés
// (prénoms), ni les endpoints (ils suffisent à pousser vers un appareil).

import { createClient } from 'npm:@supabase/supabase-js@2.112.3'
import webpush from 'npm:web-push@3.6.7'

type Subscription = { id: string; endpoint: string; p256dh: string; auth: string }
type Summary = { title: string; body: string; url: string }

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? ''

/** Le service push garde la notification 6 h si l'appareil est injoignable. */
const TTL_SECONDS = 6 * 60 * 60

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// La notification de test part du navigateur : il lui faut le préflight CORS.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

/** Comparaison à temps constant : une comparaison `===` fuit la longueur du préfixe commun. */
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const x = enc.encode(a)
  const y = enc.encode(b)
  if (x.length !== y.length || x.length === 0) return false
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i]
  return diff === 0
}

type SendResult = 'ok' | 'gone' | 'failed'

async function sendOne(sub: Subscription, summary: Summary): Promise<SendResult> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(summary),
      {
        TTL: TTL_SECONDS,
        urgency: 'high',
        vapidDetails: {
          subject: VAPID_SUBJECT,
          publicKey: VAPID_PUBLIC_KEY,
          privateKey: VAPID_PRIVATE_KEY,
        },
      },
    )
    return 'ok'
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode
    if (status === 404 || status === 410) return 'gone'
    // Ni l'endpoint ni le corps : le statut suffit à diagnostiquer.
    // Sans statut HTTP, la requête n'est jamais partie (réseau, chiffrement) : le
    // nom et le message de l'erreur sont alors techniques, sans donnée de ligne.
    console.error('push échoué', {
      subscription: sub.id,
      status: status ?? null,
      error: status ? undefined : `${(err as Error).name}: ${(err as Error).message}`.slice(0, 200),
      // Le corps de refus du service push (ex. Apple : {"reason":"BadJwtToken"}) :
      // technique, il ne porte rien du résumé.
      reason: status ? String((err as { body?: unknown }).body ?? '').slice(0, 200) : undefined,
    })
    return 'failed'
  }
}

/**
 * Envois parallèles au plus, tous utilisateurs confondus. Les heures d'envoi
 * tombent sur des quarts d'heure : un passage du cron réclame souvent plusieurs
 * résumés d'un coup, et les envoyer l'un après l'autre retarderait les derniers.
 */
const CONCURRENCY = 10

type Totals = { sent: number; gone: number; failed: number }

/**
 * Pousse chaque (abonnement, résumé) avec au plus CONCURRENCY envois en vol, puis
 * reporte le bilan en base en deux appels, quel que soit le nombre d'appareils :
 * les abonnements morts (404/410) sont supprimés, les autres datés.
 */
async function sendAll(jobs: { sub: Subscription; summary: Summary }[]): Promise<Totals> {
  const ids: Record<SendResult, string[]> = { ok: [], gone: [], failed: [] }
  let next = 0
  const worker = async () => {
    while (next < jobs.length) {
      const { sub, summary } = jobs[next++]
      ids[await sendOne(sub, summary)].push(sub.id)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker))

  await Promise.all([
    ids.ok.length > 0 && admin.rpc('push_subscriptions_ok', { p_ids: ids.ok }),
    ids.gone.length > 0 && admin.rpc('push_subscriptions_gone', { p_ids: ids.gone }),
  ])
  return { sent: ids.ok.length, gone: ids.gone.length, failed: ids.failed.length }
}

async function runCron(): Promise<Response> {
  const { data, error } = await admin.rpc('claim_due_digests')
  if (error) {
    console.error('claim_due_digests', error.code, error.message)
    return json(500, { ok: false })
  }
  const rows = (data ?? []) as { user_id: string; summary: Summary; subscriptions: Subscription[] }[]
  const totals = await sendAll(
    rows.flatMap((row) => row.subscriptions.map((sub) => ({ sub, summary: row.summary }))),
  )
  return json(200, { ok: true, users: rows.length, ...totals })
}

async function runTest(req: Request): Promise<Response> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: auth, error: authError } = await admin.auth.getUser(token)
  if (authError || !auth.user) return json(401, { ok: false })

  const { data, error } = await admin.rpc('digest_preview', { p_user_id: auth.user.id })
  if (error) {
    console.error('digest_preview', error.code, error.message)
    return json(500, { ok: false })
  }
  const row = (data as { summary: Summary; subscriptions: Subscription[] }[])[0]
  const totals = await sendAll(
    (row?.subscriptions ?? []).map((sub) => ({ sub, summary: row!.summary })),
  )
  return json(200, { ok: true, ...totals })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json(405, { ok: false })

  // Le subject est un contact réel : `mailto:` vers une vraie adresse ou `https:`
  // vers le site. Apple refuse en 403 BadJwtToken un domaine non routable
  // (`mailto:…@clarity.local`), sans autre explication.
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !/^(mailto:|https:\/\/)/.test(VAPID_SUBJECT)) {
    console.error('Secrets VAPID manquants (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT=mailto:… ou https://…)')
    return json(500, { ok: false })
  }

  const cronHeader = req.headers.get('x-cron-secret')
  if (cronHeader !== null) {
    if (!safeEqual(cronHeader, CRON_SECRET)) return json(401, { ok: false })
    return runCron()
  }

  const body = await req.json().catch(() => null)
  if (body && body.test === true) return runTest(req)
  return json(401, { ok: false })
})
