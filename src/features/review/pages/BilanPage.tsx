import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { useAppToday } from '../../../hooks/useAppToday'
import {
  selectPrincipals,
  selectSecondaries,
  useObjectives,
} from '../../../hooks/useObjectives'
import { useEnsureReview } from '../../../hooks/useReviewMutations'
import { useReview, type PeriodRef, type Review } from '../../../hooks/useReview'
import { openingKey, useReviewOpenings } from '../../../hooks/useReviewOpenings'
import { useAuth } from '../../auth/useAuth'
import { year as yearOf, type IsoDate } from '../../../lib/appDate'
import { parseBilanParam, type BilanPeriod } from '../../../lib/quarterLabels'
import {
  objectivesForPeriod,
  objectivesForQuarter,
  openingDateLabel,
} from '../../../lib/reviewPeriod'
import { BilanFlow } from '../components/BilanFlow'
import { YearBilanFlow } from '../components/YearBilanFlow'
import { useQueriesState } from '../../../hooks/useQueriesState'
import { anyLoading } from '../../../lib/queryLoading'
import { PageError, PageLoading, PageMessage } from '../../../components/layout/PageState'

/** La cérémonie en cours de traversée — figée pour la durée de la séance. */
type ActiveBilan = { review: Review }

/**
 * L'identité de la période visée. `/bilan/:year/:period` est un `element`
 * unique : passer d'un trimestre à l'autre ne remonte pas la page, et tout ce
 * qui est verrouillé pour la durée d'une séance doit savoir quand il change de
 * séance.
 */
function bilanKey(year: number, period: BilanPeriod | null): string {
  if (!period) return ''
  return `${year}|${period.type}|${period.type === 'quarter' ? period.quarter : 'y'}`
}

function periodRefOf(year: number, period: BilanPeriod): PeriodRef {
  return period.type === 'year'
    ? { type: 'year', year, index: null }
    : { type: 'quarter', year, index: period.quarter }
}

/**
 * `/bilan/:year/:period` — la cérémonie qui conclut une période.
 *
 * Le trimestre et l'année sont **deux cérémonies distinctes** (SPEC §4.4), mais
 * elles partagent leur coquille, leur table et leur adresse : un seul segment
 * d'URL les sépare. La période est **dans l'adresse** et non déduite du jour, à
 * la différence du rituel : c'est ce qui permet au bouton de T2 de l'écran Année
 * d'ouvrir T2, et à `/bilan/2025/t3` de se mettre en favori.
 *
 * Un bilan validé reste traversable : tout est librement modifiable après coup,
 * à tous les niveaux (SPEC §4.4).
 */
export function BilanPage() {
  const params = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id

  const year = Number(params.year)
  const period = parseBilanParam(params.period)

  const todayQuery = useAppToday()
  const today = todayQuery.data

  const objectivesQuery = useObjectives(Number.isFinite(year) ? year : undefined)
  const openingsQuery = useReviewOpenings(Number.isFinite(year) ? [year] : [])
  const reviewQuery = useReview(
    Number.isFinite(year) && period ? periodRefOf(year, period) : undefined,
  )

  /**
   * Qui est mis au jugement.
   *
   * Au trimestre : la règle de clôture **et** le chevauchement de fenêtre — un
   * objectif de T3 n'a rien à répondre au bilan de T2. À l'année : la seule règle
   * de clôture suffit, `useObjectives(year)` ayant déjà borné à l'année.
   */
  const subjects = useMemo(() => {
    if (!Number.isFinite(year) || !period) return { principals: [], secondaries: [] }
    const principals = selectPrincipals(objectivesQuery.data)
    const secondaries = selectSecondaries(objectivesQuery.data)
    if (period.type === 'year') {
      const start = `${year}-01-01` as IsoDate
      return {
        principals: objectivesForPeriod(principals, start),
        secondaries: objectivesForPeriod(secondaries, start),
      }
    }
    return {
      principals: objectivesForQuarter(principals, year, period.quarter),
      secondaries: objectivesForQuarter(secondaries, year, period.quarter),
    }
  }, [objectivesQuery.data, year, period])

  const { principals, secondaries } = subjects
  const stopped = useMemo(
    () =>
      selectPrincipals(objectivesQuery.data).filter(
        (o) => o.closed_at !== null && !principals.some((p) => p.id === o.id),
      ),
    [objectivesQuery.data, principals],
  )

  // Une période antérieure à l'arrivée du compte n'a aucun objectif : `existedBy`
  // (`objectivesForQuarter`) les a tous écartés. Il n'y a rien à passer en revue,
  // et le dire vaut mieux que d'ouvrir une cérémonie sans sujet.
  const nothingToReview =
    objectivesQuery.isSuccess && principals.length === 0 && secondaries.length === 0

  /**
   * La séance ouverte, **verrouillée** une fois qu'elle a commencé.
   *
   * Même verrou que le rituel, et pour la même raison : « Terminer » valide la
   * review, et sans ce verrou l'écran dépendrait d'un état serveur qu'il vient
   * lui-même de changer.
   */
  const [active, setActive] = useState<ActiveBilan | null>(null)

  // La session doit exister avant que la cérémonie n'écrive : `review.id` est la
  // cible de chaque verdict. Ouverte une seule fois, même si le rendu se rejoue.
  const ensureReview = useEnsureReview()
  const requested = useRef<string | null>(null)

  // Changer de période, c'est changer de séance. Cet effet passe AVANT celui qui
  // verrouille : sans cette remise à zéro, le verrou garderait la review du
  // trimestre quitté pendant que l'écran affiche le suivant — la route est un
  // `element` unique, la page ne se remonte pas — et « Terminer » validerait le
  // mauvais trimestre.
  const periodKey = bilanKey(year, period)
  useEffect(() => {
    setActive(null)
    requested.current = null
  }, [periodKey])

  useEffect(() => {
    if (active !== null || !reviewQuery.data) return
    setActive({ review: reviewQuery.data })
  }, [active, reviewQuery.data])

  const opening =
    Number.isFinite(year) && period
      ? openingsQuery.data?.get(
          openingKey(
            period.type,
            year,
            period.type === 'quarter' ? period.quarter : null,
          ),
        )
      : undefined

  useEffect(() => {
    if (!userId || !period || !Number.isFinite(year)) return
    if (reviewQuery.data || reviewQuery.isPending) return
    // Pas de session tant que la période n'est pas ouverte : l'écran annonce la
    // date au lieu d'ouvrir une cérémonie que la règle interdit encore.
    if (!opening?.isOpen) return
    // Ni pour une période sans sujet : ouvrir la ligne `review` d'un trimestre
    // que le compte n'a pas vécu laisserait une cérémonie fantôme en base.
    if (nothingToReview) return
    if (requested.current === periodKey) return
    requested.current = periodKey
    ensureReview.mutate({ userId, period: periodRefOf(year, period) })
  }, [
    userId,
    year,
    period,
    periodKey,
    opening,
    nothingToReview,
    reviewQuery.data,
    reviewQuery.isPending,
    ensureReview,
  ])

  const anchor: IsoDate | null =
    today && Number.isFinite(year) && yearOf(today) === year ? today : null

  const queries = [todayQuery, objectivesQuery, openingsQuery, reviewQuery]
  const { firstError, retrying, onRetry } = useQueriesState(queries, ensureReview.error)

  // Une URL bricolée ne mène nulle part : on retombe sur l'année. `year <= 0` en
  // fait partie : `Number.isFinite(0)` est vrai, mais `useObjectives` teste
  // `!!year` — la query resterait désactivée, donc l'écran en chargement.
  if (!Number.isFinite(year) || year <= 0 || period === null)
    return <Navigate to="/annee" replace />

  if (anyLoading([todayQuery, objectivesQuery, openingsQuery])) {
    return (
      <PageLoading />
    )
  }

  if (firstError) {
    return (
      <PageError
        title="Impossible d’ouvrir votre bilan"
        error={firstError}
        onRetry={onRetry}
        retrying={retrying}
      />
    )
  }

  // Jumeau de `ReviewEmpty` côté rituel : le bilan juge des objectifs, sans
  // objectif il n'a rien à juger. Le lien qui mène ici est déjà masqué dans ce
  // cas ; ce garde-fou couvre l'adresse tapée à la main.
  if (nothingToReview) {
    return (
      <PageMessage title="Aucun objectif à passer en revue">
        {period.type === 'year'
          ? `Vous n’aviez pas encore d’objectif en ${year}.`
          : 'Aucun objectif n’était porté sur ce trimestre.'}
      </PageMessage>
    )
  }

  // La règle d'ouverture est énoncée, pas découverte : le bilan d'un trimestre
  // qui n'est pas terminé n'existe pas encore, et le dire vaut mieux qu'un écran
  // vide.
  if (!active) {
    return (
      <PageMessage
        title={opening?.isOpen ? 'Votre bilan s’ouvre…' : 'Ce bilan n’est pas encore ouvert'}
      >
        {opening?.isOpen
          ? 'Un instant, on rassemble votre trimestre.'
          : opening
            ? `Il s’ouvrira le ${openingDateLabel(opening.openAt)}.`
            : 'Revenez à la fin de la période.'}
      </PageMessage>
    )
  }

  if (!userId) return <Navigate to="/annee" replace />

  return period.type === 'year' ? (
    <YearBilanFlow
      review={active.review}
      year={year}
      today={anchor}
      principals={principals}
      secondaries={secondaries}
      onClose={() => void navigate(`/annee/${year}`)}
    />
  ) : (
    <BilanFlow
      review={active.review}
      userId={userId}
      year={year}
      quarter={period.quarter}
      today={anchor}
      principals={principals}
      secondaries={secondaries}
      stopped={stopped}
      onClose={() => void navigate(`/annee/${year}/t${period.quarter}`)}
    />
  )
}
