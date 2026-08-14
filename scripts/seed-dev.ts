// Jeu de données de développement pour la stack LOCALE.
//   npm run seed:dev
//
// supabase/seed.sql ne pose que la clé de chiffrement : une base fraîche est
// vide, et tant que les écrans de création n'existent pas il n'y a aucun moyen
// de voir le dashboard peuplé. Ce script comble ce trou — il est jetable.
//
// Idempotent : il efface d'abord les données du compte de dev, puis les recrée.
// Refuse de s'exécuter ailleurs qu'en local (garde-fou explicite).

import { readFileSync } from 'node:fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const EMAIL = 'dev@clarity.test'
const PASSWORD = 'dev-Passw0rd!'

function readDotenv(name: string): string | undefined {
  for (const file of ['../.env.development.local', '../.env.local']) {
    try {
      const raw = readFileSync(new URL(file, import.meta.url), 'utf8')
      const line = raw.split('\n').find((l) => l.startsWith(`${name}=`))
      if (line) return line.slice(name.length + 1).trim()
    } catch {
      /* fichier absent */
    }
  }
  return undefined
}

function env(name: string, dotenvName: string): string {
  const v = process.env[name] ?? readDotenv(dotenvName)
  if (!v) throw new Error(`${name} manquant (env, .env.development.local ou .env.local)`)
  return v
}

const URL_ = env('SUPABASE_URL', 'VITE_SUPABASE_URL')
const ANON = env('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY')

if (!/127\.0\.0\.1|localhost/.test(URL_)) {
  throw new Error(
    `seed:dev ne s'exécute que contre la stack locale (URL reçue : ${URL_}).\n` +
      'Lancer `npx supabase start`, ou supprimer la variable pointant vers le hosted.',
  )
}

// --- dates (mêmes règles que src/lib/appDate.ts, en plus court) --------------

type IsoDate = string

function iso(d: Date): IsoDate {
  return d.toISOString().slice(0, 10)
}
function addDays(date: IsoDate, days: number): IsoDate {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return iso(d)
}
function isoWeekday(date: IsoDate): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay() || 7
}
function startOfWeek(date: IsoDate): IsoDate {
  return addDays(date, 1 - isoWeekday(date))
}

async function main() {
  const client: SupabaseClient = createClient(URL_, ANON, { auth: { persistSession: false } })

  // Compte de dev : créé au premier passage, réutilisé ensuite.
  const { error: signUpError } = await client.auth.signUp({
    email: EMAIL,
    password: PASSWORD,
    options: { data: { display_name: 'Camille Durand' } },
  })
  if (signUpError && !/already registered/i.test(signUpError.message)) {
    throw new Error(`signUp : ${signUpError.message}`)
  }
  const { error: signInError } = await client.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  })
  if (signInError) throw new Error(`signIn : ${signInError.message}`)

  const { data: userData } = await client.auth.getUser()
  const uid = userData.user!.id

  const { data: todayData, error: todayError } = await client.rpc('app_today')
  if (todayError) throw new Error(`app_today : ${todayError.message}`)
  const today = todayData as IsoDate
  const year = Number(today.slice(0, 4))
  const quarter = Math.ceil(Number(today.slice(5, 7)) / 3)
  const quarterStart = `${year}-${String((quarter - 1) * 3 + 1).padStart(2, '0')}-01`

  // --- remise à zéro ---------------------------------------------------------
  // L'onboarding se rejoue à chaque seed : c'est aussi le moyen de le tester.
  await client.from('task').delete().eq('user_id', uid)
  await client.from('objective').delete().eq('user_id', uid)
  await client.from('list').delete().eq('user_id', uid)
  await client.from('profile').update({ onboarded_at: null }).eq('id', uid)

  // --- listes ----------------------------------------------------------------
  const { data: lists, error: listError } = await client
    .from('list')
    .insert([
      { user_id: uid, name: 'Perso', color: '#8f9bde', position: 0 },
      { user_id: uid, name: 'Atelier', color: '#e8590c', position: 1 },
    ])
    .select('id, name')
  if (listError) throw new Error(`listes : ${listError.message}`)
  const listPerso = lists![0]!.id as string
  const listAtelier = lists![1]!.id as string

  // --- objectifs -------------------------------------------------------------
  // Trois cadences différentes pour couvrir les deux rendus de carte :
  // 7 = pastilles de jours, < 7 = anneau.
  const objectiveSpecs = [
    { label: 'SPORT', title: 'Courir le marathon de Paris', cadence: 3 },
    { label: 'ATELIER', title: 'Lancer Atelier Studio', cadence: 7 },
    { label: 'LECTURE', title: 'Lire 24 livres cette année', cadence: 2 },
  ]
  const { data: objectives, error: objectiveError } = await client
    .from('objective')
    .insert(
      // slot omis : le trigger prend le plus petit emplacement libre.
      objectiveSpecs.map((o) => ({ user_id: uid, year, kind: 'principal', ...o })),
    )
    .select('id, title, cadence, slot')
  if (objectiveError) throw new Error(`objectifs : ${objectiveError.message}`)

  // --- jalons du trimestre en cours -----------------------------------------
  const milestoneTitles = [
    ['Passer sous 50 min au 10 km', 'Semi en compétition'],
    ['Landing page en ligne', '5 premiers clients'],
    ['12 livres au 30 juin', 'Rejoindre un book club'],
  ]
  const { error: milestoneError } = await client.from('milestone').insert(
    objectives!.flatMap((o, i) =>
      milestoneTitles[i]!.map((title, j) => ({
        objective_id: o.id,
        year,
        quarter,
        position: j,
        title,
        // le premier jalon de chaque objectif est atteint
        completed_at: j === 0 ? new Date().toISOString() : null,
      })),
    ),
  )
  if (milestoneError) throw new Error(`jalons : ${milestoneError.message}`)

  // --- historique du trimestre ----------------------------------------------
  // Des tâches complétées, réparties sur les semaines écoulées. Ce sont les
  // triggers qui en déduisent objective_week — on n'écrit jamais ce relevé.
  const now = new Date().toISOString()
  const history: Record<string, unknown>[] = []
  for (const [i, objective] of objectives!.entries()) {
    const cadence = objective.cadence as number
    // Quelques semaines sous la cadence, pour que la heatmap ne soit pas pleine.
    for (let monday = startOfWeek(quarterStart); monday <= today; monday = addDays(monday, 7)) {
      const weekIndex = Math.round(
        (Date.parse(`${monday}T12:00:00Z`) - Date.parse(`${quarterStart}T12:00:00Z`)) / 604_800_000,
      )
      const missed = (weekIndex + i) % 4 === 0 ? 1 : 0
      const daysThisWeek = Math.max(0, cadence - missed)
      for (let d = 0; d < daysThisWeek; d++) {
        // Étale les jours actifs sur la semaine plutôt que de les grouper.
        const day = addDays(monday, Math.floor((d * 7) / Math.max(daysThisWeek, 1)))
        if (day > today) continue
        history.push({
          user_id: uid,
          objective_id: objective.id,
          title: `Séance ${objective.title.split(' ')[0]!.toLowerCase()}`,
          due_date: day,
          completed_at: now,
          position: 0,
        })
      }
    }
  }
  // Insertion par lots : PostgREST plafonne les réponses à 1000 lignes.
  for (let i = 0; i < history.length; i += 200) {
    const { error } = await client.from('task').insert(history.slice(i, i + 200))
    if (error) throw new Error(`historique : ${error.message}`)
  }

  // --- tâches du jour, en retard, à venir ------------------------------------
  const [objSport, objAtelier, objLecture] = objectives!

  const { error: taskError } = await client.from('task').insert([
    // aujourd'hui — dont deux déjà cochées, qui restent visibles barrées
    {
      user_id: uid,
      objective_id: objSport!.id,
      list_id: listPerso,
      title: 'Sortie longue 18 km',
      due_date: today,
      completed_at: now,
      position: 0,
    },
    {
      user_id: uid,
      objective_id: objAtelier!.id,
      list_id: listAtelier,
      title: 'Maquette de l’atelier',
      due_date: today,
      completed_at: now,
      position: 1,
    },
    {
      user_id: uid,
      objective_id: objLecture!.id,
      list_id: listPerso,
      title: 'Lire 30 pages',
      due_date: today,
      position: 2,
    },
    {
      user_id: uid,
      title: 'Réserver le dentiste',
      due_date: today,
      is_important: true,
      position: 3,
    },
    {
      user_id: uid,
      list_id: listAtelier,
      title: 'Répondre aux devis',
      due_date: today,
      recurrence: { type: 'weekly', interval: 1, weekdays: [isoWeekday(today)] },
      position: 4,
    },
    // en retard
    {
      user_id: uid,
      list_id: listAtelier,
      title: 'Relancer le fournisseur',
      due_date: addDays(today, -3),
      is_important: true,
      position: 0,
    },
    {
      user_id: uid,
      title: 'Déclarer les frais du trimestre',
      due_date: addDays(today, -9),
      position: 1,
    },
    // demain et cette semaine
    { user_id: uid, list_id: listPerso, title: 'Courses', due_date: addDays(today, 1), position: 0 },
    {
      user_id: uid,
      objective_id: objLecture!.id,
      title: 'Finir le chapitre 4',
      due_date: addDays(today, 2),
      position: 1,
    },
  ])
  if (taskError) throw new Error(`tâches : ${taskError.message}`)

  const { count } = await client
    .from('task')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', uid)

  console.log(`Seed appliqué sur ${URL_}`)
  console.log(`  compte    : ${EMAIL} / ${PASSWORD}`)
  console.log(`  objectifs : ${objectives!.map((o) => `${o.title} (slot ${o.slot}, cadence ${o.cadence})`).join(', ')}`)
  console.log(`  tâches    : ${count} (dont ${history.length} d'historique)`)
  console.log(`  trimestre : Q${quarter} ${year}, depuis le ${quarterStart}`)
  console.log('  onboarding remis à zéro')
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
