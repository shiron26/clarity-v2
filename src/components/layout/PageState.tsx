import type { ReactNode } from 'react'
import { ErrorState } from '../ui/ErrorState'
import { Spinner } from '../ui/Spinner'
import { dataErrorMessage } from '../../lib/errorMessage'

/**
 * Le chargement d'un écran : un spinner, centré sur toute la hauteur.
 *
 * Les sept pages du produit portaient ce même `div` — la sortie anticipée d'un
 * écran est un motif de mise en page, pas une décision d'écran.
 */
export function PageLoading() {
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner className="text-ink-muted" />
    </div>
  )
}

type PageErrorProps = {
  title: string
  error: Error
  onRetry: () => void
  retrying?: boolean
}

/**
 * L'échec de chargement d'un écran. Le message serveur ne passe jamais tel quel :
 * `dataErrorMessage` est appliqué ici, une fois pour toutes (AGENTS.md).
 */
export function PageError({ title, error, onRetry, retrying }: PageErrorProps) {
  return (
    <div className="flex h-full items-center justify-center px-5">
      <ErrorState
        title={title}
        description={dataErrorMessage(error)}
        onRetry={onRetry}
        retrying={retrying}
        className="max-w-md"
      />
    </div>
  )
}

type PageMessageProps = {
  title: string
  children: ReactNode
}

/**
 * Une phrase calme au milieu d'un écran : « rien à faire », « pas encore
 * ouvert ». Ni erreur ni état vide illustré — juste une nouvelle, posée.
 */
export function PageMessage({ title, children }: PageMessageProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-5 text-center">
      <h1 className="text-title font-semibold">{title}</h1>
      <p className="max-w-100 text-body leading-relaxed text-ink-3">{children}</p>
    </div>
  )
}
