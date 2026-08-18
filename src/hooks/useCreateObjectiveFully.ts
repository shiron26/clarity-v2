// La création complète d'un objectif : la ligne, ses étapes, son premier relevé.
//
// Dans `src/hooks/` et non dans une feature : l'onboarding (§2) et le formulaire
// de l'écran Objectifs (§4) créent le même objet, et une feature n'importe jamais
// d'une autre (AGENTS.md). Il n'a d'ailleurs jamais rien eu d'onboarding — il ne
// fait que composer des mutations partagées.
//
// Ce hook n'écrit rien lui-même : il enchaîne les mutations qui existent déjà,
// pour que le chemin d'écriture d'un objectif reste unique. Il ne porte que
// l'ordre et la règle de rattachement.
//
// Jusqu'à trois écritures selon la mesure, et AUCUNE transaction : PostgREST
// n'en offre pas, et il n'existe pas de RPC pour ça. Si la seconde échoue,
// l'objectif existe — c'est le comportement, pas un accident, et l'écran le dit.
// Les jalons se reposent depuis l'écran Objectifs, un relevé se resaisit au
// rituel. Préférable à une RPC qui devrait dupliquer en SQL la validation par
// mesure.
import { useMutation } from '@tanstack/react-query'
import { useCreateObjective } from './useObjectiveMutations'
import { useCreateMilestones } from './useMilestoneMutations'
import { useAddObjectiveEntry } from './useObjectiveEntries'
import {
  draftMilestones,
  parseAmount,
  toNewObjective,
  type ObjectiveDraft,
} from '../lib/objectiveDraft'
import { quarterOf, type IsoDate } from '../lib/appDate'

export function useCreateObjectiveFully() {
  const createObjective = useCreateObjective()
  const createMilestones = useCreateMilestones()
  const addEntry = useAddObjectiveEntry()

  return useMutation({
    mutationFn: async (input: {
      draft: ObjectiveDraft
      userId: string
      year: number
      today: IsoDate
    }): Promise<string> => {
      const { draft, userId, year, today } = input

      const objectiveId = await createObjective.mutateAsync(
        toNewObjective(draft, { userId, year }),
      )

      if (draft.measure === 'jalons') {
        const titles = draftMilestones(draft)
        if (titles.length > 0) {
          // Un jalon vit dans un trimestre, jamais dans une année : celui de
          // l'objectif s'il est trimestriel, sinon le trimestre en cours. Les
          // suivants se posent au bilan (SPEC §3 — aucun report automatique).
          await createMilestones.mutateAsync({
            objectiveId,
            year,
            quarter: draft.quarter ?? quarterOf(today),
            titles,
          })
        }
      }

      // Le point de départ n'existe qu'en mode relevé — en cumul on part de 0 et
      // l'écran ne pose pas la question. Le modèle n'a pas de colonne pour cette
      // valeur : la conserver, c'est en faire le premier relevé. `entry_date`
      // n'est jamais envoyée, le serveur la pose au jour applicatif.
      if (draft.measure === 'quantite' && draft.entryMode === 'releve') {
        const start = parseAmount(draft.startValue)
        if (start !== null && start !== 0) {
          await addEntry.mutateAsync({ objectiveId, value: start })
        }
      }

      return objectiveId
    },
  })
}
