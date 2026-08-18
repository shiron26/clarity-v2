// Écritures sur les objectifs. Basse fréquence : pas d'optimistic update, une
// simple invalidation en onSettled suffit (modèle useCompleteOnboarding).
//
// Les colonnes d'identité (`user_id`, `year`, `kind`, `slot`) sont immuables
// après création : l'édition ne les envoie jamais, sinon le trigger lève
// `objective_identity_immutable`.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../lib/queryKeys'
import { TIMESTAMP_SIGNAL, deleteView, insertView, updateView } from '../lib/viewWrites'
import type { ObjectiveMeasure } from './useObjectives'
import type { PeriodUnit } from './useObjectivePeriods'

export type ObjectiveKind = 'principal' | 'secondaire'

export type NewObjective = {
  userId: string
  year: number
  /** `null` = objectif annuel ; 1–4 pour un trimestre. Figé après création. */
  quarter: number | null
  kind: ObjectiveKind
  label: string
  title: string
  why: string | null
  description: string | null
  /**
   * Le type de mesure, figé après création : le changer orphelinerait
   * l'historique de `objective_period`. Il n'est volontairement pas déduit de la
   * cadence — c'est une réponse de l'utilisateur, pas un effet de bord.
   */
  measure: ObjectiveMeasure
  /** Requis sur `habitude` et `quantite`, nul sur `jalons`. Figé lui aussi. */
  periodUnit: PeriodUnit | null
  /** Obligatoire sur une habitude, doit rester null sur les autres mesures. */
  cadence: number | null
  /** Cible : facultative sur une habitude, obligatoire sur une quantité. */
  targetValue: number | null
  /** Libellé d'affichage de la cible ; `null` = sans unité. Quantité seulement. */
  unit: string | null
  /** Quantité seulement : le relevé remplace, le cumul additionne. */
  entryMode: 'cumul' | 'releve' | null
  /**
   * Quantité seulement, et jamais choisie à la main : déduite du point de départ
   * face à la cible (`directionOf`, `src/lib/objectiveDraft.ts`).
   */
  direction: 'atteindre' | 'sous' | null
  /**
   * Quantité seulement : l'origine de l'échelle de progression. 0 pour un cumul,
   * la valeur du jour pour un relevé. Le serveur la fige après création.
   */
  startValue: number | null
}

/**
 * Ce qui reste modifiable après création.
 *
 * Le complément exact de `objective_identity_immutable` : `measure`,
 * `period_unit`, `entry_mode`, `quarter`, `year`, `kind` et `slot` sont figés —
 * changer l'unité de période orphelinerait l'historique d'`objective_period`, et
 * basculer cumul → relevé changerait rétroactivement le sens des saisies passées.
 */
export type ObjectiveEdits = {
  label: string
  title: string
  why: string | null
  description: string | null
  cadence: number | null
  /** La cible bouge : c'est tout l'objet de l'ajustement de rythme (§9). */
  targetValue: number | null
  unit: string | null
  /**
   * Recalculée à chaque écriture, jamais recopiée : déplacer la cible de 70 à
   * 85 kg quand on part de 78 retourne le sens de l'objectif. Le point de départ,
   * lui, est figé côté serveur et n'est pas renvoyé.
   */
  direction: 'atteindre' | 'sous' | null
}

/**
 * `slot` n'est volontairement pas envoyé : le serveur attribue le plus petit
 * emplacement libre sous verrou, et lève `slot_full` s'il n'en reste aucun.
 *
 * Renvoie l'`id` créé : les jalons et le premier relevé d'un objectif quantifié
 * s'y rattachent, et PostgREST ne sait pas les écrire dans la même requête.
 */
export function useCreateObjective() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: NewObjective): Promise<string> => {
      const { data, error } = await insertView('objective', {
        user_id: input.userId,
        space_id: null,
        parent_objective_id: null,
        year: input.year,
        quarter: input.quarter,
        kind: input.kind,
        label: input.label,
        title: input.title,
        why: input.why,
        description: input.description,
        measure: input.measure,
        period_unit: input.periodUnit,
        cadence: input.cadence,
        target_value: input.targetValue,
        unit: input.unit,
        entry_mode: input.entryMode,
        direction: input.direction,
        start_value: input.startValue,
      })
        .select('id')
        .single()
      if (error) throw error
      // Une vue rend toutes ses colonnes nullables dans les types générés — le
      // RETURNING d'un INSERT, lui, en porte forcément une.
      return data.id as string
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.objective.all })
    },
  })
}

export function useUpdateObjective() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, edits }: { id: string; edits: ObjectiveEdits }) => {
      const { error } = await updateView('objective', {
        label: edits.label,
        title: edits.title,
        why: edits.why,
        description: edits.description,
        cadence: edits.cadence,
        target_value: edits.targetValue,
        unit: edits.unit,
        direction: edits.direction,
      }).eq('id', id)
      if (error) throw error
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.objective.all })
    },
  })
}

/**
 * Alléger le rythme — et **rien d'autre**.
 *
 * `useUpdateObjective` prend un `ObjectiveEdits` complet (titre, cible, unité…) et
 * les renvoie tous. Ici on n'envoie que `cadence`, ce qui **garantit** ce que
 * l'écran de retour promet en toutes lettres — *votre cible ne change pas* — au
 * lieu de le promettre. Une copie qui dépend de ce que l'appelant a bien voulu
 * mettre dans son payload est une copie qu'on finit par démentir.
 *
 * `cadence` est modifiable après création, contrairement à `measure`,
 * `period_unit` et `entry_mode` — l'ajustement de rythme est précisément le cas
 * qui justifie cette exception (SPEC §3).
 */
export function useAdjustCadence() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, cadence }: { id: string; cadence: number }) => {
      const { error } = await updateView('objective', { cadence }).eq('id', id)
      if (error) throw error
    },
    onSettled: () => {
      // La cadence est la cible d'`objective_period` : elle se fige à la première
      // activité de chaque période, donc les périodes déjà ouvertes gardent
      // l'ancienne. Le relevé et la régularité changent quand même de sens à
      // partir de la suivante — on invalide les deux.
      void queryClient.invalidateQueries({ queryKey: queryKeys.objective.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.objectiveRegularity.all })
    },
  })
}


/**
 * Clôturer = « atteint », déclaré par l'utilisateur et réversible (SPEC §3).
 * Aucune ligne `objective_period` n'est produite pendant la clôture, d'où
 * l'invalidation du relevé hebdomadaire en plus de l'objectif.
 */
export function useCloseObjective() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, closed }: { id: string; closed: boolean }) => {
      const { error } = await updateView('objective', {
        closed_at: closed ? TIMESTAMP_SIGNAL : null,
      }).eq('id', id)
      if (error) throw error
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.objective.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.objectivePeriod.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.objectiveRegularity.all })
    },
  })
}

/**
 * Supprimer libère le slot sans décaler les autres. Les jalons partent en
 * cascade ; les tâches survivent, simplement détachées (`on delete set null`) —
 * d'où l'invalidation des tâches.
 */
export function useDeleteObjective() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await deleteView('objective').eq('id', id)
      if (error) throw error
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.objective.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.milestone.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.task.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.objectivePeriod.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.objectiveRegularity.all })
    },
  })
}
