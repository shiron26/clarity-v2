import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/database'
import type { Recurrence } from '../../src/lib/recurrence'

type Client = SupabaseClient<Database>

// Même raison que `src/lib/viewWrites.ts` : `supabase gen types` n'émet `Insert` que
// pour les vraies tables, et `task` / `objective` / `milestone` sont des VUES
// déchiffrantes — elles n'ont qu'une `Row`. Le cast est concentré ici plutôt que
// dispersé dans les tests.
function insertRow(client: Client, view: 'task' | 'objective' | 'milestone', row: object) {
  return client.from(view).insert(row as never)
}

/**
 * Le jour applicatif, lu au serveur.
 *
 * « Aujourd'hui » ne vient JAMAIS de l'horloge du navigateur ni de celle de Node :
 * le fuseau de l'application vit dans `private.app_config` et n'est pas lisible côté
 * client. Un test qui calculerait sa date avec `new Date()` serait faux une partie de
 * la journée, et faux en CI (runners en UTC).
 */
export async function appToday(client: Client): Promise<string> {
  const { data, error } = await client.rpc('app_today')
  if (error) throw new Error(`app_today a échoué : ${error.message}`)
  return data as string
}

/** Arithmétique de dates sur des chaînes `YYYY-MM-DD`, sans fuseau. */
export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** Le lundi de la semaine ISO d'une date — la semaine du produit va lundi → dimanche. */
export function lundiDeLaSemaine(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`)
  const jour = date.getUTCDay() || 7 // dimanche = 7, pas 0
  return addDays(iso, 1 - jour)
}

/** Le numéro de semaine ISO, tel que le calcule aussi `extract(week from …)`. */
export function numeroSemaineIso(iso: string): number {
  const jeudi = new Date(`${lundiDeLaSemaine(iso)}T00:00:00Z`)
  jeudi.setUTCDate(jeudi.getUTCDate() + 3) // le jeudi décide de l'année ISO
  const debut = new Date(Date.UTC(jeudi.getUTCFullYear(), 0, 4))
  const lundiDeS1 = new Date(debut)
  lundiDeS1.setUTCDate(debut.getUTCDate() - ((debut.getUTCDay() || 7) - 1))
  return Math.round((jeudi.getTime() - lundiDeS1.getTime()) / (7 * 86_400_000)) + 1
}

/** Le trimestre civil d'une date `YYYY-MM-DD`, de 1 à 4. */
export function trimestreDe(iso: string): number {
  return Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1
}

export type NewTask = {
  title: string
  dueDate?: string | null
  objectiveId?: string | null
  isImportant?: boolean
  recurrence?: Recurrence | null
}

/**
 * Crée une tâche par l'API.
 *
 * On prépare les données par l'API plutôt que par l'interface chaque fois que la
 * création n'est pas l'objet du test : c'est plus rapide, et surtout ça évite qu'un
 * test sur la complétion échoue parce que le formulaire de création est cassé.
 */
export async function createTask(
  client: Client,
  userId: string,
  task: NewTask,
): Promise<string> {
  const { data, error } = await insertRow(client, 'task', {
    user_id: userId,
    space_id: null,
    assignee_id: null,
    list_id: null,
    objective_id: task.objectiveId ?? null,
    title: task.title,
    description: null,
    due_date: task.dueDate === undefined ? null : task.dueDate,
    is_important: task.isImportant ?? false,
    recurrence: task.recurrence ?? null,
  })
    .select('id')
    .single()

  if (error) throw new Error(`Création de tâche impossible : ${error.message}`)
  return (data as { id: string }).id
}

export type NewObjective = {
  label: string
  title: string
  measure: 'habitude' | 'quantite' | 'jalons'
  kind?: 'principal' | 'secondaire'
  year: number
  quarter?: number | null
  cadence?: number | null
  periodUnit?: 'week' | 'month' | null
  targetValue?: number | null
  unit?: string | null
  entryMode?: 'cumul' | 'releve' | null
  startValue?: number | null
  direction?: 'atteindre' | 'sous' | null
}

/**
 * Crée un objectif par l'API.
 *
 * La contrainte `objective_measure_shape` est stricte : chaque mesure impose la
 * présence de certains champs ET l'absence des autres (une habitude n'a ni
 * `entry_mode` ni `start_value`, un objectif à jalons n'a ni cadence ni période).
 * D'où les `null` explicites — les omettre laisserait passer un `undefined` que
 * PostgREST traduirait différemment.
 *
 * `slot` n'est jamais envoyé : le serveur attribue le plus petit libre sous verrou et
 * lève `slot_full` s'il n'en reste aucun.
 */
export async function createObjective(
  client: Client,
  userId: string,
  objective: NewObjective,
): Promise<string> {
  const { data, error } = await insertRow(client, 'objective', {
    user_id: userId,
    space_id: null,
    parent_objective_id: null,
    year: objective.year,
    quarter: objective.quarter ?? null,
    kind: objective.kind ?? 'principal',
    label: objective.label,
    title: objective.title,
    measure: objective.measure,
    period_unit: objective.periodUnit ?? null,
    cadence: objective.cadence ?? null,
    target_value: objective.targetValue ?? null,
    unit: objective.unit ?? null,
    entry_mode: objective.entryMode ?? null,
    start_value: objective.startValue ?? null,
    direction: objective.direction ?? null,
  })
    .select('id')
    .single()

  if (error) throw new Error(`Création d’objectif impossible : ${error.message}`)
  return (data as { id: string }).id
}

/** Crée un objectif « habitude » avec les champs qu'impose sa mesure. */
export function createHabit(
  client: Client,
  userId: string,
  args: { label: string; title: string; year: number; cadence?: number },
): Promise<string> {
  return createObjective(client, userId, {
    ...args,
    measure: 'habitude',
    periodUnit: 'week',
    cadence: args.cadence ?? 3,
  })
}

export async function createMilestones(
  client: Client,
  objectiveId: string,
  year: number,
  quarter: number,
  titles: string[],
): Promise<void> {
  const { error } = await insertRow(
    client,
    'milestone',
    titles.map((title) => ({ objective_id: objectiveId, year, quarter, title })),
  )
  if (error) throw new Error(`Création de jalons impossible : ${error.message}`)
}

/**
 * Supprime tous les objectifs du compte.
 *
 * Indispensable en `afterEach` : les places sont limitées à 3 principaux et 5
 * secondaires, et l'unicité porte sur le CHEVAUCHEMENT de fenêtre, pas sur l'année.
 * Sans ce nettoyage, le troisième test d'un worker se heurterait à `slot_full`.
 * Le DELETE est libre côté serveur, contrairement à la modification de la nature d'un
 * objectif.
 */
export async function deleteAllObjectives(client: Client, userId: string): Promise<void> {
  const { error } = await client.from('objective').delete().eq('user_id', userId)
  if (error) throw new Error(`Nettoyage des objectifs impossible : ${error.message}`)
}
