import type { ReactNode } from 'react'
import { cn } from '../../../lib/cn'
import { ErrorState } from '../../../components/ui/ErrorState'
import { dataErrorMessage } from '../../../lib/errorMessage'
import { WidgetGlyph } from '../components/WidgetGlyph'

/**
 * La coquille commune des widgets : c'est le `rounded-2xl bg-surface p-5
 * shadow-card` que chaque bloc du dashboard recopiait, plus l'en-tête à trois
 * places (titre, méta, action) qu'ils dessinaient chacun de leur côté.
 *
 * Elle porte aussi l'erreur, parce qu'un widget en panne ne doit pas vider
 * l'écran : il dit ce qui lui manque, à sa place, et les autres continuent.
 *
 * Elle prend TOUTE la hauteur de sa cellule (`h-full`) : les widgets d'une même
 * ligne s'alignent alors sur le plus grand, au lieu de laisser des marches d'
 * escalier entre des cartes de tailles voisines. Avec un plafond, sans quoi une
 * liste de trente articles étirerait ses voisines sur tout l'écran — passé cette
 * hauteur, c'est le contenu qui défile, pas la carte qui grandit.
 */
type WidgetCardProps = {
  title: string
  /**
   * Un glyphe au trait devant le titre. Il sert aux widgets qui se ressemblent —
   * trois aide-mémoire côte à côte ne se distinguent que par leur nom, et un nom
   * se lit, il ne se repère pas.
   */
  icon?: ReactNode
  /**
   * Teinte de la pastille, prise dans la palette des listes. En style inline
   * comme toutes les couleurs de liste du produit : elles sont des données, pas
   * des classes. Sans elle, la pastille reste grise.
   */
  iconColor?: string | null
  /** Une ligne de contexte à droite du titre : dates, décompte, total. */
  meta?: ReactNode
  /** Lien ou bouton, aligné à droite sous la méta. */
  action?: ReactNode
  error?: Error | null
  onRetry?: () => void
  retrying?: boolean
  className?: string
  children: ReactNode
}

export function WidgetCard({
  title,
  icon,
  iconColor,
  meta,
  action,
  error,
  onRetry,
  retrying,
  className,
  children,
}: WidgetCardProps) {
  return (
    <section
      className={cn(
        'flex h-full max-h-[34rem] min-w-0 flex-col rounded-2xl bg-surface p-5 shadow-card',
        className,
      )}
    >
      <div className="mb-2.5 flex shrink-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {icon && <WidgetGlyph icon={icon} color={iconColor} />}
          <h2 className="min-w-0 truncate text-card font-semibold">{title}</h2>
        </div>
        {(meta || action) && (
          <div className="flex shrink-0 items-center gap-3 text-label text-ink-muted">
            {meta}
            {action}
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {error ? (
          <ErrorState description={dataErrorMessage(error)} onRetry={onRetry} retrying={retrying} />
        ) : (
          children
        )}
      </div>
    </section>
  )
}

/** La phrase d'un widget sans contenu : calme, sans bordure ni invitation. */
export function WidgetEmpty({ children }: { children: ReactNode }) {
  return <p className="py-1 text-body text-ink-3">{children}</p>
}
