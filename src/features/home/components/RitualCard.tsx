import { Link } from 'react-router'
import { buttonClasses } from '../../../components/ui/buttonClasses'
import { weekDatesLabel } from '../../../lib/reviewPeriod'
import type { IsoDate } from '../../../lib/appDate'

/**
 * L'encart du rituel, en tête du dashboard.
 *
 * Fond nuit et bouton bleu : le bleu reste réservé à l'action. Un dégradé bleu
 * pleine largeur dépenserait la couleur d'action en décoration, ce que
 * `DESIGN.md` interdit — et forcerait un bouton blanc délavé par-dessus.
 *
 * L'encart n'apparaît que si le rituel de la semaine est ouvert et pas encore
 * validé : rien ne s'empile, sauter une semaine ne fabrique pas un rappel de
 * plus (SPEC-REFONTE §7).
 */
type RitualCardProps = {
  weekNo: number
  /** Lundi de la semaine en cours — l'ancre de la plage de dates affichée. */
  weekStart: IsoDate
  /** Combien d'objectifs seront à passer en revue. */
  objectiveCount: number
}

export function RitualCard({ weekNo, weekStart, objectiveCount }: RitualCardProps) {
  return (
    <section className="flex flex-wrap items-center gap-4 rounded-2xl bg-night px-5 py-4.5 text-white">
      <div className="min-w-50 flex-1">
        <h2 className="text-card font-semibold">Rituel de la semaine</h2>
        <p className="mt-1 text-label text-ink-onnight">
          Semaine {weekNo} · {weekDatesLabel(weekStart)} · {objectiveCount} objectif
          {objectiveCount > 1 ? 's' : ''} à passer en revue
        </p>
      </div>

      <Link to="/review" className={buttonClasses({ className: 'shrink-0' })}>
        Commencer mon rituel →
      </Link>
    </section>
  )
}
