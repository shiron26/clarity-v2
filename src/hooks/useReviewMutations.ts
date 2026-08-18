// Écritures de la review. Basse fréquence (quelques clics par semaine) : pas
// d'optimistic update, une invalidation en onSettled suffit.
//
// Deux chemins d'écriture différents et c'est normal :
//   · `public.review` est une vraie table, sans colonne chiffrée → écriture directe ;
//   · `public.review_item` est une vue déchiffrante → `insertView` / `updateView`,
//     qui concentrent l'unique cast et interdisent d'envoyer les colonnes serveur.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { TIMESTAMP_SIGNAL, insertView, updateView } from '../lib/viewWrites'
import type { PeriodRef, Review, ReviewItem } from './useReview'

const REVIEW_COLUMNS = 'id, period_type, period_year, period_index, validated_at, created_by'


async function selectReview(userId: string, period: PeriodRef): Promise<Review | null> {
  let query = supabase
    .from('review')
    .select(REVIEW_COLUMNS)
    .eq('user_id', userId)
    .eq('period_type', period.type)
    .eq('period_year', period.year)

  query = period.index === null
    ? query.is('period_index', null)
    : query.eq('period_index', period.index)

  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return data
}

/**
 * Ouvre la session d'une période, ou rend celle qui existe déjà.
 *
 * L'unicité `(user_id, period_type, period_year, period_index)` est garantie en
 * base : si deux onglets démarrent le même rituel en même temps, le second
 * reçoit un 23505 et relit la ligne du premier plutôt que d'échouer.
 * `created_by` n'est jamais envoyé — il vaut `auth.uid()` par défaut, et la
 * policy d'insertion l'exige.
 */
export function useEnsureReview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      userId,
      period,
    }: {
      userId: string
      period: PeriodRef
    }): Promise<Review> => {
      const existing = await selectReview(userId, period)
      if (existing) return existing

      const { data, error } = await supabase
        .from('review')
        .insert({
          user_id: userId,
          space_id: null,
          period_type: period.type,
          period_year: period.year,
          period_index: period.index,
        })
        .select(REVIEW_COLUMNS)
        .single()

      if (error) {
        if (error.code !== '23505') throw error
        const raced = await selectReview(userId, period)
        if (!raced) throw error
        return raced
      }
      return data
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.review.all })
    },
  })
}

export type RateObjectiveInput = {
  reviewId: string
  objectiveId: string
  /** `id` de l'item existant, absent à la première note portée sur cet objectif. */
  itemId?: string
  /**
   * Uniquement ce qui change. La fusée et le commentaire se posent par deux
   * gestes distincts et souvent rapprochés (on tape une note, on clique une
   * fusée) : envoyer les deux champs à chaque fois ferait écraser la valeur
   * fraîche par celle, périmée, du cache. Le trigger INSTEAD OF conserve les
   * colonnes absentes du SET, elles ne partent donc pas à null.
   *
   * **Une exception, et elle vient de là.** `rating` et `achieved` s'excluent sur
   * une même ligne (`review_item_verdict_exclusive`), et comme `new` porte les
   * valeurs anciennes des colonnes hors SET, poser l'un sans effacer l'autre
   * lèverait la règle. Basculer d'une forme à l'autre exige donc d'envoyer les
   * **deux** champs — d'où `verdictPatch()` / `ratingPatch()` ci-dessous.
   */
  patch: { rating?: number | null; achieved?: boolean | null; comment?: string | null }
}

/** Le verdict, et la note effacée avec — les deux ne cohabitent pas. */
function verdictPatch(achieved: boolean | null): RateObjectiveInput['patch'] {
  return { achieved, rating: null }
}

/** La note, et le verdict effacé avec. Symétrique de `verdictPatch`. */
function ratingPatch(rating: number | null): RateObjectiveInput['patch'] {
  return { rating, achieved: null }
}

/**
 * Pose (ou corrige) le jugement porté sur un objectif dans une session.
 *
 * Semaine : la note seule. Année : le verdict seul. Trimestre : l'un **ou**
 * l'autre selon que la fenêtre de l'objectif se poursuit ou se ferme (REFONTE §8).
 *
 * Pas d'`upsert` PostgREST : la cible est une vue à trigger INSTEAD OF, le
 * `ON CONFLICT` n'y a aucune contrainte à viser. On choisit donc explicitement
 * entre insert et update — et on rattrape le cas où deux gestes rapprochés
 * tentent tous deux l'insertion avant que le premier n'ait rafraîchi le cache.
 */
export function useRateObjective() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: RateObjectiveInput) => {
      if (input.itemId) {
        const { error } = await updateView('review_item', input.patch).eq('id', input.itemId)
        if (error) throw error
        return
      }

      const { error } = await insertView('review_item', {
        review_id: input.reviewId,
        objective_id: input.objectiveId,
        ...input.patch,
      })
      if (!error) return
      if (error.code !== '23505') throw error

      // La note existait déjà : c'est une correction, pas une création.
      const { data: existing, error: selectError } = await supabase
        .from('review_item')
        .select('id')
        .eq('review_id', input.reviewId)
        .eq('objective_id', input.objectiveId)
        .maybeSingle()
      if (selectError) throw selectError
      if (!existing?.id) throw error

      const { error: updateError } = await updateView('review_item', input.patch).eq(
        'id',
        existing.id,
      )
      if (updateError) throw updateError
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.review.all })
    },
  })
}

/**
 * « Validée » signifie « le rituel a eu lieu », pas « tout est noté » (SPEC §4.4).
 * Seul celui qui a démarré la session peut valider — le trigger le vérifie et
 * impose `validated_by`.
 */
export function useValidateReview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (reviewId: string) => {
      // `.select().single()` et non un `update` nu : sans lui, un UPDATE qui ne
      // touche AUCUNE ligne (id inconnu, RLS qui refuse) renvoie 204 et passe pour
      // un succès. La cérémonie se déclarait alors terminée sans l'être, et son
      // encart revenait indéfiniment. `single()` lève un PGRST116 sur zéro ligne.
      const { error } = await supabase
        .from('review')
        .update({ validated_at: TIMESTAMP_SIGNAL })
        .eq('id', reviewId)
        .select('id')
        .single()
      if (error) throw error
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.review.all })
    },
  })
}

/**
 * Les trois écritures d'un bilan, prêtes à passer aux decks : noter, trancher,
 * commenter.
 *
 * Le bilan de trimestre et celui d'année les écrivaient à l'identique — même
 * résolution de l'`itemId` depuis la table des items, trois fois chacun. La
 * règle « un item par (review, objectif), créé à la première écriture » ne se
 * restate plus d'un flow à l'autre.
 */
export function useReviewItemWriter(
  reviewId: string,
  items: Map<string, ReviewItem> | undefined,
) {
  const rateObjective = useRateObjective()

  const write = (objectiveId: string, patch: RateObjectiveInput['patch']) =>
    rateObjective.mutate({ reviewId, objectiveId, itemId: items?.get(objectiveId)?.id, patch })

  return {
    rate: (objectiveId: string, rating: number | null) => write(objectiveId, ratingPatch(rating)),
    verdict: (objectiveId: string, achieved: boolean) => write(objectiveId, verdictPatch(achieved)),
    comment: (objectiveId: string, text: string | null) => write(objectiveId, { comment: text }),
    error: rateObjective.error,
  }
}
