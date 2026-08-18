import { cn } from '../../../lib/cn'
import { weekDatesLabel } from '../../../lib/reviewPeriod'
import type { IsoDate } from '../../../lib/appDate'

type RitualWeekCardProps = {
  weekNo: number
  monday: IsoDate
  /** La session de la semaine a été validée. */
  done: boolean
  current: boolean
  /** Le lundi est après l'ancre serveur : la semaine n'est pas vécue. */
  future: boolean
  /**
   * Aucun objectif ne couvre cette semaine — typiquement parce qu'elle précède
   * la création des objectifs (`objectivesForWeek`). Il n'y a rien à constater.
   */
  nothing: boolean
  /** L'ouverture est passée (`review_openings`) : le rituel est faisable. */
  openable: boolean
  onOpen: () => void
}

/**
 * Une semaine du trimestre : son numéro, ses dates, et une coche quand le
 * rendez-vous a été tenu.
 *
 * L'ancienne carte portait une fusée par objectif, colorée par sa note. Le
 * rituel ne note plus rien — la notation vit au bilan du trimestre — et une
 * carte de semaine parle du **rendez-vous**, pas des objectifs : trois symboles
 * sans donnée derrière ne diraient rien de plus que la coche.
 *
 * Elle s'ouvre : un rituel passé reste faisable, « le rituel n'est jamais une
 * porte » (REFONTE §7). Une semaine dont l'ouverture n'est pas venue ne clique
 * pas, et la règle est déjà énoncée par la bannière.
 *
 * Une semaine **sans objectif** ne clique pas non plus, et c'est la seule
 * exception à « jamais une porte » : le rituel constate ce qui a avancé, et il
 * n'y a rien à constater sur une semaine antérieure aux objectifs. Le tiret d'une
 * semaine vécue y mentirait, il se lit comme un rendez-vous manqué.
 */
export function RitualWeekCard({
  weekNo,
  monday,
  done,
  current,
  future,
  nothing,
  openable,
  onOpen,
}: RitualWeekCardProps) {
  // Deux façons de n'avoir rien à faire, une seule matière : la carte en
  // pointillés. Ce qui les distingue est écrit dans la carte, pas dans son cadre.
  const inert = future || nothing

  return (
    <button
      type="button"
      disabled={!openable}
      onClick={onOpen}
      aria-label={
        nothing
          ? `Semaine ${weekNo}, ${weekDatesLabel(monday)} : aucun objectif à passer en revue`
          : `Rituel de la semaine ${weekNo}, ${weekDatesLabel(monday)}`
      }
      className={cn(
        'flex flex-col items-center rounded-xl px-4.5 py-4.5 transition-all duration-150',
        'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
        inert
          ? 'cursor-default border-[1.5px] border-dashed border-border-strong'
          : 'bg-surface',
        !inert && (openable ? 'cursor-pointer' : 'cursor-default'),
        // La semaine vécue se repère avant d'être ouverte : son liseré ne dépend
        // donc pas de l'heure d'ouverture, seulement du calendrier.
        !inert && current && 'border-2 border-today',
        !inert && !current && 'border border-border',
        !inert && !current && openable && 'hover:border-border-strong',
      )}
    >
      <span
        className={cn(
          'text-center text-card',
          current ? 'font-bold text-ink' : 'font-semibold text-ink-muted',
        )}
      >
        S{weekNo}
      </span>
      <span
        className={cn('mt-0.5 text-center text-label', current ? 'text-ink-3' : 'text-ink-muted')}
      >
        {weekDatesLabel(monday)}
      </span>

      {/* Hauteur réservée même vide : sans elle, la grille se déforme d'une
          ligne à l'autre selon les semaines déjà faites. */}
      <div className="mt-3 flex min-h-5 items-center justify-center">
        {nothing ? (
          <span className="text-center text-caption leading-tight text-ink-muted">
            aucun objectif
          </span>
        ) : (
          !future &&
          (done ? (
            <svg
              viewBox="0 0 24 24"
              className="size-5 text-success"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M8 12.5l2.5 2.5L16 9.5" />
            </svg>
          ) : (
            <span aria-hidden className="text-label leading-none text-ink-muted">
              —
            </span>
          ))
        )}
      </div>
    </button>
  )
}
