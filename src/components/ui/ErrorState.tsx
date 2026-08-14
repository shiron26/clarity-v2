import { cn } from '../../lib/cn'
import { Button } from './Button'

type ErrorStateProps = {
  title?: string
  description: string
  onRetry?: () => void
  retrying?: boolean
  className?: string
}

// Bloc d'erreur avec action de récupération — pendant de `Alert`, qui reste la
// phrase inline sans action (formulaires auth). Deux responsabilités distinctes :
// `Alert` énonce, `ErrorState` propose de réessayer.
//
// `EmptyState` n'est volontairement pas réutilisé : sa sémantique est « il n'y a
// rien ici », pas « ça a raté », et son vocabulaire visuel (icône bleue, bordure
// pointillée) est celui de l'état vide.
export function ErrorState({
  title = 'Impossible de charger ces données',
  description,
  onRetry,
  retrying = false,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col gap-3 rounded-lg bg-danger-bg px-4 py-3.5',
        'sm:flex-row sm:items-center sm:justify-between sm:gap-5',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-body font-semibold text-danger">{title}</span>
        <span className="text-label leading-relaxed text-ink-2">{description}</span>
      </div>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          loading={retrying}
          onClick={onRetry}
          className="shrink-0 self-start sm:self-auto"
        >
          Réessayer
        </Button>
      )}
    </div>
  )
}
