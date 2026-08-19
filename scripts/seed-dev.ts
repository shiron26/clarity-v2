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
  // `kind` : les trois aide-mémoire sont semés par le serveur à l'inscription et
  // refusent la suppression. Sans ce filtre, le trigger lève
  // `list_memo_undeletable` et l'instruction ENTIÈRE échoue — les listes de dev
  // ne seraient pas effacées non plus, et le seed les dupliquerait à chaque tour.
  await client.from('list').delete().eq('user_id', uid).eq('kind', 'task')
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

  // --- objectifs principaux ---------------------------------------------------
  //
  // **Trois principaux simultanés au maximum**, et c'est le budget qui dicte ce
  // jeu de données : on prend une mesure de chaque, pour que les cinq états de
  // l'écran Objectifs (REFONTE §4) soient tous atteignables.
  //
  //   SPORT   habitude annuelle      → état `a`
  //   ÉPARGNE quantité annuelle      → état `b` (courbe + bouton de saisie)
  //   PERMIS  jalons, ce trimestre   → état `c` (pas de bloc sombre, tâches reliées)
  //   PIANO   habitude, T précédent  → état `d` (arrêté) — hors des trois slots
  //   LECTURE quantité secondaire    → état `e`
  //
  // Un quatrième principal chevauchant aujourd'hui serait refusé en `slot_full`.
  const { data: objectives, error: objectiveError } = await client
    .from('objective')
    .insert({
      // slot omis : le trigger prend le plus petit emplacement libre.
      user_id: uid,
      year,
      kind: 'principal',
      label: 'SPORT',
      title: 'Courir le marathon de Paris',
      measure: 'habitude',
      period_unit: 'week',
      cadence: 3,
      target_value: 120,
    })
    .select('id, title, cadence, slot')
  if (objectiveError) throw new Error(`objectifs : ${objectiveError.message}`)

  const { data: quantified, error: quantifiedError } = await client
    .from('objective')
    .insert({
      user_id: uid,
      year,
      kind: 'principal',
      label: 'ÉPARGNE',
      title: 'Mettre 6 000 € de côté',
      measure: 'quantite',
      period_unit: 'month',
      target_value: 6000,
      unit: '€',
      entry_mode: 'releve',
      direction: 'atteindre',
      start_value: 0,
    })
    .select('id, title, slot')
    .single()
  if (quantifiedError) throw new Error(`objectif quantifié : ${quantifiedError.message}`)

  // Jalonné et PRINCIPAL : seul un principal perso peut porter des tâches
  // (`task_objective_invalid_target`), et c'est la bande « Tâches reliées » de
  // l'état `c` qu'on veut pouvoir regarder.
  const { data: jalonne, error: jalonneError } = await client
    .from('objective')
    .insert({
      user_id: uid,
      year,
      quarter,
      kind: 'principal',
      label: 'PERMIS',
      title: 'Passer le permis bateau',
      measure: 'jalons',
    })
    .select('id, title, slot')
    .single()
  if (jalonneError) throw new Error(`objectif jalonné : ${jalonneError.message}`)

  // Un relevé, pour que l'état `b` ait une valeur. `entry_date` n'est jamais
  // envoyée (le serveur la pose au jour applicatif) : toutes les saisies d'un
  // seed tombent donc aujourd'hui, et la courbe n'a qu'un point. C'est une
  // limite assumée du seed, pas un défaut de l'écran.
  const { error: quantifiedEntryError } = await client
    .from('objective_entry')
    .insert({ objective_id: quantified!.id as string, value: 4400 })
  if (quantifiedEntryError) throw new Error(`relevé : ${quantifiedEntryError.message}`)

  // --- un objectif ARRÊTÉ (état `d`) ------------------------------------------
  // Sur un trimestre révolu : clôturer ne libère pas le slot, c'est la fin de la
  // fenêtre qui le libère. Posé sur le trimestre courant, il occuperait une des
  // trois places et la création échouerait en `slot_full`.
  let stoppedId: string | null = null
  const stoppedQuarter = quarter - 1
  const stoppedQuarterStart = `${year}-${String((stoppedQuarter - 1) * 3 + 1).padStart(2, '0')}-01`

  if (quarter > 1) {
    const { data: piano, error: pianoError } = await client
      .from('objective')
      .insert({
        user_id: uid,
        year,
        quarter: stoppedQuarter,
        kind: 'principal',
        label: 'PIANO',
        title: 'Apprendre le piano',
        measure: 'habitude',
        period_unit: 'week',
        cadence: 2,
        target_value: 26,
      })
      .select('id')
      .single()
    if (pianoError) throw new Error(`objectif arrêté : ${pianoError.message}`)
    stoppedId = piano!.id as string
  }

  // --- secondaires : les deux autres mesures ---------------------------------
  // Un quantifié mensuel et un jalonné. Ils n'ont ni cadence ni tâches ; ils
  // existent pour que les écrans de la refonte (§2 à §4) aient de la matière des
  // trois types sans qu'on ait à en fabriquer à la main.
  const { data: secondaries, error: secondaryError } = await client
    .from('objective')
    .insert([
      {
        user_id: uid,
        year,
        kind: 'secondaire',
        label: 'LECTURE',
        title: 'Lire 24 livres cette année',
        measure: 'quantite',
        period_unit: 'month',
        target_value: 24,
        unit: '',
        entry_mode: 'cumul',
        direction: 'atteindre',
        start_value: 0,
      },
      {
        // Une cible à la BAISSE : le point de départ (78 kg) est au-dessus de
        // la cible (70 kg), donc `direction: 'sous'`. Sans ce cas dans le seed,
        // rien à l'écran ne permet de voir qu'une barre peut se remplir en
        // descendant.
        user_id: uid,
        year,
        kind: 'secondaire',
        label: 'POIDS',
        title: 'Descendre à 70 kg',
        measure: 'quantite',
        period_unit: 'month',
        target_value: 70,
        unit: 'kg',
        entry_mode: 'releve',
        direction: 'sous',
        start_value: 78,
      },
      {
        user_id: uid,
        year,
        kind: 'secondaire',
        label: 'BUREAU',
        title: 'Refaire le bureau',
        measure: 'jalons',
      },
    ])
    .select('id, title, measure')
  if (secondaryError) throw new Error(`secondaires : ${secondaryError.message}`)

  // Quelques relevés sur le quantifié. `entry_date` n'est pas envoyée : le
  // serveur la pose au jour applicatif — on ne peut donc pas antidater, et
  // toutes les saisies tombent aujourd'hui. C'est assumé pour un seed.
  const objLivres = secondaries!.find((o) => o.title === 'Lire 24 livres cette année')!
  const objPoids = secondaries!.find((o) => o.title === 'Descendre à 70 kg')!
  const { error: entryError } = await client.from('objective_entry').insert([
    ...[3, 2, 2].map((value) => ({ objective_id: objLivres.id as string, value })),
    // Le premier relevé porte le point de départ, les suivants la descente :
    // 78 → 75 kg, soit 3 kg parcourus sur les 8 attendus.
    ...[78, 76, 75].map((value) => ({ objective_id: objPoids.id as string, value })),
  ])
  if (entryError) throw new Error(`saisies : ${entryError.message}`)

  // --- jalons du trimestre en cours -----------------------------------------
  // Sur l'habitude et sur les deux jalonnés — une quantité n'a pas d'étapes,
  // l'écran ne lui affiche d'ailleurs pas la bande.
  const objBureau = secondaries!.find((o) => o.measure === 'jalons')!
  const milestoneCarriers = [...objectives!, jalonne!, objBureau]
  const milestoneTitles = [
    ['Passer sous 50 min au 10 km', 'Semi en compétition'],
    ['Dossier déposé', 'Code obtenu', '20 h de navigation'],
    ['Choisir le bureau', 'Repeindre le mur'],
  ]
  const { error: milestoneError } = await client.from('milestone').insert(
    milestoneCarriers.flatMap((o, i) =>
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

  // L'habitude vivante sur le trimestre courant, et l'objectif arrêté sur le
  // sien — sans quoi l'état `d` afficherait une grille vide, ce qui ne
  // ressemble pas à un objectif porté deux mois puis abandonné.
  const habitRuns: Array<{ id: string; title: string; cadence: number; from: IsoDate; to: IsoDate }> =
    objectives!.map((o) => ({
      id: o.id as string,
      title: o.title as string,
      cadence: o.cadence as number,
      from: quarterStart,
      to: today,
    }))
  if (stoppedId) {
    habitRuns.push({
      id: stoppedId,
      title: 'Apprendre le piano',
      cadence: 2,
      from: stoppedQuarterStart,
      // Arrêté en cours de trimestre : la frise s'arrête là où la personne
      // s'est arrêtée, elle ne se prolonge pas en vide.
      to: addDays(stoppedQuarterStart, 46),
    })
  }

  for (const [i, objective] of habitRuns.entries()) {
    const cadence = objective.cadence
    // Quelques semaines sous la cadence, pour que la heatmap ne soit pas pleine.
    for (let monday = startOfWeek(objective.from); monday <= objective.to; monday = addDays(monday, 7)) {
      const weekIndex = Math.round(
        (Date.parse(`${monday}T12:00:00Z`) - Date.parse(`${objective.from}T12:00:00Z`)) / 604_800_000,
      )
      const missed = (weekIndex + i) % 4 === 0 ? 1 : 0
      const daysThisWeek = Math.max(0, cadence - missed)
      for (let d = 0; d < daysThisWeek; d++) {
        // Étale les jours actifs sur la semaine plutôt que de les grouper.
        const day = addDays(monday, Math.floor((d * 7) / Math.max(daysThisWeek, 1)))
        if (day > objective.to) continue
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

  // La clôture vient APRÈS l'historique : un objectif arrêté est en lecture
  // seule (`objective_archived_read_only` / le trigger de tâche refuse), donc
  // lui poser des séances ensuite échouerait.
  //
  // La valeur envoyée n'est lue que comme un signal booléen : c'est `now()` côté
  // serveur qui date la clôture.
  if (stoppedId) {
    const { error: closeError } = await client
      .from('objective')
      .update({ closed_at: new Date().toISOString() })
      .eq('id', stoppedId)
    if (closeError) throw new Error(`clôture : ${closeError.message}`)
  }

  // --- tâches du jour, en retard, à venir ------------------------------------
  // Seuls les principaux perso peuvent porter des tâches : l'habitude et le
  // jalonné. Une quantité avance par ses relevés, pas par des cases cochées.
  const [objSport] = objectives!

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
      objective_id: jalonne!.id,
      list_id: listAtelier,
      title: 'Réserver 4 h de navigation',
      due_date: today,
      completed_at: now,
      position: 1,
    },
    {
      user_id: uid,
      objective_id: jalonne!.id,
      list_id: listPerso,
      title: 'Relire le code maritime',
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
      objective_id: objSport!.id,
      title: 'Fractionné 8 × 400 m',
      due_date: addDays(today, 2),
      position: 1,
    },
    // le pool — ni date ni objectif obligatoires (REFONTE §5). Sans lui, la vue
    // « Sans date » serait vide en dev alors qu'elle est le cœur de l'écran.
    // Leur ancienneté n'apparaît qu'au-delà d'une semaine : `created_at` est
    // posée par le serveur, elle ne se remonte pas depuis le client.
    {
      user_id: uid,
      objective_id: jalonne!.id,
      list_id: listAtelier,
      title: 'Trouver un club pour le semi',
      position: 0,
    },
    { user_id: uid, list_id: listPerso, title: 'Appeler le dentiste', position: 1 },
    { user_id: uid, title: 'Comparer les assurances auto', position: 2 },
    { user_id: uid, title: 'Ranger le garage', position: 3 },
  ])
  if (taskError) throw new Error(`tâches : ${taskError.message}`)

  const { count } = await client
    .from('task')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', uid)

  console.log(`Seed appliqué sur ${URL_}`)
  console.log(`  compte    : ${EMAIL} / ${PASSWORD}`)
  console.log(
    `  principaux : ${[...objectives!, quantified!, jalonne!].map((o) => `${o.title} (slot ${o.slot})`).join(', ')}`,
  )
  console.log(`  secondaires : ${secondaries!.map((o) => `${o.title} (${o.measure})`).join(', ')}`)
  if (quarter === 1) {
    console.log('  ⚠ pas d’objectif arrêté : il demande un trimestre révolu, or on est en T1')
  }
  console.log(`  tâches    : ${count} (dont ${history.length} d'historique)`)
  console.log(`  trimestre : Q${quarter} ${year}, depuis le ${quarterStart}`)
  console.log('  onboarding remis à zéro')
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
