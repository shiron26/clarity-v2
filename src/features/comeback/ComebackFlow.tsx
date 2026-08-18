import { useMemo, useState } from 'react'
import { RitualOverlay } from '../../components/ritual/RitualOverlay'
import { DeckCard } from '../../components/ritual/DeckCard'
import { DeckHeading } from '../../components/ritual/DeckHeading'
import { DeckRecap } from '../../components/ritual/DeckRecap'
import { Spinner } from '../../components/ui/Spinner'
import { ComebackCard } from './components/ComebackCard'
import { CadenceOfferDeck } from './components/CadenceOfferDeck'
import { absenceLine, cadenceOffers, comebackLines } from './comebackContent'
import { useAppToday } from '../../hooks/useAppToday'
import { useLastSeen } from '../../hooks/useLastSeen'
import { useMilestones } from '../../hooks/useMilestones'
import { useObjectiveActiveDays } from '../../hooks/useObjectiveActiveDays'
import { useAdjustCadence } from '../../hooks/useObjectiveMutations'
import { useObjectiveProgress } from '../../hooks/useObjectiveProgress'
import { useObjectiveRegularity } from '../../hooks/useObjectiveRegularity'
import { selectPrincipals, useObjectives } from '../../hooks/useObjectives'
import { quarterOf, year as yearOf, yearBounds } from '../../lib/appDate'
import { distinctDays } from '../../lib/objectiveState'
import { anyLoading } from '../../lib/queryLoading'
import { DeckAction } from '../../components/ritual/DeckAction'

/**
 * Le retour après une longue absence (REFONTE §9).
 *
 * Le pain point d'origine du produit est que l'absence produit une **dette** : ne
 * pas ouvrir ne coûte rien sur le moment, mais fabrique un trou qui se lit comme
 * un échec. Le rituel (§7) l'a déplacée du jour à la semaine ; reste le cas
 * qu'aucun rituel ne rattrape — plusieurs semaines sautées d'affilée. La réponse
 * n'est pas un rappel mais un **accueil**.
 *
 * Monté dans `AppShell` plutôt que sur une route, comme `OnboardingFlow` : c'est
 * un écran qui s'ouvre tout seul, et un gate de redirection dans `ProtectedRoute`
 * ferait dépendre chaque route d'un état qui ne la concerne pas. Les deux ne
 * peuvent pas se croiser — quelqu'un qui revient est onboardé.
 *
 * Il rend `null` tant qu'il n'a rien à dire, ce qui est le cas de très loin le
 * plus fréquent.
 */
export function ComebackFlow() {
  const { absence } = useLastSeen()
  const [dismissed, setDismissed] = useState(false)
  const [step, setStep] = useState(0)
  const [offerIndex, setOfferIndex] = useState(0)

  const todayQuery = useAppToday()
  const today = todayQuery.data
  const year = today ? yearOf(today) : undefined

  // Les queries ne partent que s'il y a une absence à annoncer : cet écran ne se
  // montre presque jamais, il n'a pas à peser sur chaque chargement de l'app.
  const active = absence !== null && !dismissed
  const objectivesQuery = useObjectives(active ? year : undefined)

  const principals = useMemo(
    () => selectPrincipals(objectivesQuery.data),
    [objectivesQuery.data],
  )
  const principalIds = useMemo(() => principals.map((o) => o.id), [principals])

  const bounds = today ? yearBounds(today) : undefined
  const activeDaysQuery = useObjectiveActiveDays(
    active ? principalIds : [],
    bounds?.from,
    bounds?.to,
  )
  const regularityQuery = useObjectiveRegularity(active ? principalIds : [])
  const progressQuery = useObjectiveProgress(active ? principalIds : [])
  const milestonesQuery = useMilestones(
    active ? principalIds : [],
    year,
    today ? quarterOf(today) : undefined,
  )

  const regularity = useMemo(
    () => regularityQuery.data ?? new Map(),
    [regularityQuery.data],
  )

  const lines = useMemo(
    () =>
      comebackLines({
        objectives: principals,
        regularity,
        progress: progressQuery.data ?? new Map(),
        milestones: milestonesQuery.data ?? [],
      }),
    [principals, regularity, progressQuery.data, milestonesQuery.data],
  )

  const offers = useMemo(
    () => cadenceOffers(principals, regularity),
    [principals, regularity],
  )

  const adjustCadence = useAdjustCadence()

  // On mène avec le cumul : « jours actifs cette année » est le seul chiffre qui
  // ne peut structurellement pas avoir baissé pendant une absence. C'est la preuve
  // que rien n'a été retiré — précisément ce à quoi sert un compteur monotone.
  const activeDays = useMemo(
    () => distinctDays(activeDaysQuery.data ?? new Set<string>()),
    [activeDaysQuery.data],
  )

  const loading = anyLoading([objectivesQuery, activeDaysQuery, regularityQuery])

  // Sans objectif, il n'y a rien à retrouver : l'accueil n'aurait ni chiffre ni
  // cartes, et se lirait comme un état vide de plus.
  if (!active || (objectivesQuery.isSuccess && principals.length === 0)) return null

  // Le nombre d'écrans dépend de ce qu'il y a à proposer — la maquette déclare
  // 2 sur le premier deck et 3 sur les suivants, c'est un vestige du cas court.
  const total = offers.length > 0 ? 3 : 2
  const offer = offers[offerIndex]

  function close() {
    setDismissed(true)
  }

  function nextOffer() {
    if (offerIndex < offers.length - 1) setOfferIndex(offerIndex + 1)
    else close()
  }

  return (
    <RitualOverlay label="Bon retour" step={step + 1} total={total} onClose={close}>
      {loading ? (
        <Spinner className="text-ink-onnight" />
      ) : step === 0 ? (
        <DeckRecap
          eyebrow="Bon retour"
          count={activeDays}
          headline={activeDays === 1 ? 'jour actif cette année' : 'jours actifs cette année'}
          detail={`${absenceLine(absence.gap)} Vos objectifs sont là où vous les avez laissés.`}
          nextLabel="Reprendre mes objectifs →"
          onNext={() => setStep(1)}
        />
      ) : step === 1 ? (
        <>
          {/* Le titre doit rester VRAI : rien n'avance tout seul, c'est
              l'utilisateur qui court et qui fait ses virements. La seule chose qui
              a bougé passivement, c'est la régularité — des périodes vides sont
              entrées dans la fenêtre de quatre. */}
          <DeckHeading eyebrow="Où vous en êtes">
            Seule votre régularité
            <br />a bougé
          </DeckHeading>

          <div className="mt-6.5 flex w-full flex-col gap-2.5">
            {lines.map((line, index) => (
              <ComebackCard key={line.objective.id} line={line} index={index} />
            ))}
          </div>

          <DeckAction
            onClick={() => (offers.length > 0 ? setStep(2) : close())}
            className="mt-6.5"
          >
            {/* Le dernier écran ne promet pas une suite qui n'existe pas. */}
            {offers.length > 0 ? 'Continuer →' : 'Reprendre mes objectifs →'}
          </DeckAction>
        </>
      ) : offer ? (
        <CadenceOfferDeck
          key={offer.objective.id}
          offer={offer}
          pending={adjustCadence.isPending}
          onAccept={() =>
            adjustCadence.mutate(
              { id: offer.objective.id, cadence: offer.to },
              // On avance dans les deux cas : un échec d'écriture ne doit pas
              // retenir quelqu'un dans une cérémonie qu'il traverse une fois.
              { onSettled: nextOffer },
            )
          }
          onKeep={nextOffer}
        />
      ) : (
        // Garde-fou : la liste d'offres peut se vider sous nos pieds si une
        // invalidation rend une régularité fraîche entre deux écrans.
        <DeckCard>
          <p className="text-body text-ink-onnight">Rien à ajuster.</p>
        </DeckCard>
      )}
    </RitualOverlay>
  )
}
