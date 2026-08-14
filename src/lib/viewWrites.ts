import { supabase } from './supabase'
import type { Database } from '../types/database'

// Les entités chiffrées sont exposées en vues `public.*` écrivables via des
// triggers INSTEAD OF. Mais `supabase gen types` n'émet `Insert`/`Update` que
// pour les vraies tables : une vue n'a qu'une `Row`. Écrire dans ces vues avec
// le client typé est donc impossible sans franchir le typage.
//
// Plutôt que de disperser des casts dans chaque hook, on le fait ici, une fois —
// et on en profite pour rendre la règle projet vérifiable à la compilation :
// les colonnes imposées par les triggers ne sont même pas proposées.

type Views = Database['public']['Views']

export type WritableView = 'task' | 'list' | 'objective' | 'milestone' | 'space' | 'review_item'

/** Colonnes imposées par les triggers — jamais confiées au client (AGENTS.md). */
type ServerColumn =
  | 'id'
  | 'created_at'
  | 'created_by'
  | 'completed_by'
  | 'updated_at'
  | 'validated_by'
  | 'slot'

export type ViewPatch<V extends WritableView> = Partial<Omit<Views[V]['Row'], ServerColumn>>

/**
 * `updateView('task', { completed_at }).eq('id', id)` — chaînable comme
 * n'importe quel builder PostgREST. Penser à `if (error) throw error`.
 *
 * Le `as never` est le seul cast du module : il satisfait un builder qui attend
 * une `Row` complète alors qu'un UPDATE est partiel. Le payload, lui, reste
 * vérifié contre `ViewPatch` au point d'appel.
 */
export function updateView<V extends WritableView>(view: V, patch: ViewPatch<V>) {
  return supabase.from(view).update(patch as never)
}

/**
 * `insertView('objective', { … }).select().single()`.
 *
 * Le type reste `Partial` : une vue n'expose qu'une `Row`, il n'existe aucun
 * type `Insert` à opposer. Ce sont les triggers qui exigent les colonnes
 * obligatoires — et les colonnes serveur restent exclues comme en update, ce
 * qui interdit notamment d'envoyer `slot` (le serveur attribue le plus petit
 * libre ; le fournir contournerait l'attribution et risquerait un doublon).
 */
export function insertView<V extends WritableView>(view: V, row: ViewPatch<V>) {
  return supabase.from(view).insert(row as never)
}

/** `deleteView('milestone').eq('id', id)` — le filtre est à la charge de l'appelant. */
export function deleteView<V extends WritableView>(view: V) {
  return supabase.from(view).delete()
}
