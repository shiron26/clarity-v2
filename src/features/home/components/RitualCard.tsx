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
 * Trois états, un seul bloc. **Ouvert** : le rituel attend, rien ne s'empile,
 * sauter une semaine ne fabrique pas un rappel de plus (SPEC-REFONTE §7).
 * **À venir** : le compte à rebours jusqu'à vendredi. **Sans objet** : aucun
 * objectif à passer en revue cette semaine, on le dit et on n'invite à rien.
 *
 * C'est un widget qu'on pose soi-même : il n'a pas à se taire les jours creux, et
 * une carte qui s'effacerait quatre jours sur sept laisserait un trou dans la grille.
 */
type RitualCardProps = {
  weekNo: number
  /** Lundi de la semaine en cours — l'ancre de la plage de dates affichée. */
  weekStart: IsoDate
  /** Combien d'objectifs seront à passer en revue. */
  objectiveCount: number
  /** Le rituel est-il ouvert, ou seulement en approche ? */
  open: boolean
  /**
   * Jours avant l'ouverture, quand il n'est pas encore ouvert. `0` le vendredi
   * avant 18 h : ce jour-là il ouvre le soir même, et l'écrire vaut mieux que
   * « dans 0 jour ».
   */
  daysUntil: number
  /** Lundi de la semaine précédente, si elle a été notée. */
  lastNotedWeek?: IsoDate
}

export function RitualCard({
  weekNo,
  weekStart,
  objectiveCount,
  open,
  daysUntil,
  lastNotedWeek,
}: RitualCardProps) {
  const nothingToReview = objectiveCount === 0
  const objectives = `${objectiveCount} objectif${objectiveCount > 1 ? 's' : ''} à passer en revue`

  return (
    <section className="flex flex-wrap items-center gap-4 rounded-2xl bg-night px-5 py-4.5 text-white">
      <div className="min-w-50 flex-1">
        <h2 className="text-card font-semibold">
          {open ? 'Rituel de la semaine' : countdown(daysUntil)}
        </h2>
        <p className="mt-1 text-label text-ink-onnight">
          Semaine {weekNo} · {weekDatesLabel(weekStart)} ·{' '}
          {nothingToReview ? 'aucun objectif à passer en revue' : objectives}
          {lastNotedWeek && ` · semaine du ${weekDatesLabel(lastNotedWeek)} notée`}
        </p>
      </div>

      {/* Rien à noter : pas de bouton du tout. Proposer d'ouvrir une séance vide
          serait une invitation à ne rien faire. */}
      {!nothingToReview &&
        (open ? (
          <Link to="/review" className={buttonClasses({ className: 'shrink-0' })}>
            Commencer mon rituel →
          </Link>
        ) : (
          // Secondaire tant que ce n'est pas ouvert : il n'y a rien à faire encore,
          // et un bouton bleu appellerait une action qui n'existe pas.
          <Link
            to="/review"
            className={buttonClasses({ variant: 'secondary', className: 'shrink-0' })}
          >
            Voir le rituel
          </Link>
        ))}
    </section>
  )
}

function countdown(daysUntil: number): string {
  if (daysUntil === 0) return 'Rituel ce soir à 18 h'
  if (daysUntil === 1) return 'Rituel demain'
  return `Rituel dans ${daysUntil} jours`
}
