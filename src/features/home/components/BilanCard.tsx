import { Link } from 'react-router'
import { buttonClasses } from '../../../components/ui/buttonClasses'
import { bilanPath, quarterRangeLabel, type BilanPeriod } from '../../../lib/quarterLabels'

type BilanCardProps = {
  year: number
  period: BilanPeriod
  /** Combien d'objectifs seront à conclure ou à noter. */
  objectiveCount: number
}

/**
 * L'encart du bilan, en tête du dashboard.
 *
 * Jumeau de `RitualCard` — même fond nuit, même bouton bleu, même densité. La
 * ressemblance est voulue : ce sont deux rendez-vous de même nature, et leur
 * donner deux apparences ferait croire à deux mécaniques.
 *
 * Un seul encart de cérémonie à la fois (`usePendingBilan`) : deux rappels côte
 * à côte transformeraient un rendez-vous en arriéré, exactement la dette que la
 * refonte enlève.
 */
export function BilanCard({ year, period, objectiveCount }: BilanCardProps) {
  const title = period.type === 'year' ? `Bilan de ${year}` : `Bilan du trimestre ${period.quarter}`
  const range =
    period.type === 'year' ? 'janvier → décembre' : quarterRangeLabel(period.quarter)

  return (
    <section className="flex flex-wrap items-center gap-4 rounded-2xl bg-night px-5 py-4.5 text-white">
      <div className="min-w-50 flex-1">
        <h2 className="text-card font-semibold">{title}</h2>
        <p className="mt-1 text-label text-ink-onnight">
          {range} · {objectiveCount} objectif{objectiveCount > 1 ? 's' : ''} à passer en revue
        </p>
      </div>

      <Link to={bilanPath(year, period)} className={buttonClasses({ className: 'shrink-0' })}>
        Faire mon bilan →
      </Link>
    </section>
  )
}
