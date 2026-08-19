import { Link } from 'react-router'

/**
 * Le jour où rien n'est dû : une phrase calme et une porte de sortie facultative.
 * Pas de rouge, pas d'icône, pas de bordure — il n'y a rien à combler.
 *
 * Cette copie vivait dans « Aujourd'hui », qui a disparu : il redisait mot pour mot
 * les lignes que « Votre semaine » affiche déjà pour le jour en cours. La phrase,
 * elle, méritait de survivre — elle est la seule du produit qui dise qu'un jour
 * sans est un jour sans.
 */
export function EmptyToday({
  hasObjectives,
  weekComplete,
  sessionsThisWeek,
}: {
  hasObjectives: boolean
  weekComplete: boolean
  sessionsThisWeek: number
}) {
  if (!hasObjectives) {
    return (
      <div className="px-5 py-6.5 text-center">
        <p className="text-body font-medium text-ink-2">Rien à faire pour l’instant</p>
        <p className="mx-auto mt-1.5 max-w-75 text-[11px] leading-relaxed text-ink-muted">
          Posez un objectif d’abord. Les tâches viendront s’y relier — et vous pourrez les
          cocher sans jamais leur donner de date.
        </p>
      </div>
    )
  }

  return (
    <div className="px-5 py-6.5 text-center">
      <p className="text-body font-medium text-ink-2">Rien de prévu aujourd’hui.</p>
      <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">
        {weekComplete
          ? `Vos ${sessionsThisWeek} séances de la semaine sont faites. Il n’y a rien à rattraper.`
          : 'Rien n’était attendu aujourd’hui — un jour sans est un jour sans, pas un trou.'}
      </p>
      <Link
        to="/taches?vue=sans-date"
        className="mt-3.5 inline-block text-label font-medium text-primary transition-colors hover:text-primary-hover"
      >
        Piocher dans les tâches sans date →
      </Link>
    </div>
  )
}
