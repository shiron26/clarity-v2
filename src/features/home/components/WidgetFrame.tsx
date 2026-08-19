import type { ReactNode } from 'react'
import { cn } from '../../../lib/cn'
import { SegmentedGroup } from '../../../components/ui/SegmentedGroup'
import { DragHandle } from '../../../components/dnd/DragHandle'
import type { DragHandleProps } from '../../../components/dnd/useSortableItem'
import type { WidgetInstance, WidgetSpan } from '../dashboardLayout'
import { spansOf, widgetDef, widgetLabel } from '../widgets/registry'

const SPAN_LABELS: Record<WidgetSpan, string> = { 1: 'Tiers', 2: 'Deux tiers', 3: 'Plein' }

/**
 * L'enveloppe d'un widget en mode Organiser : la poignée, la largeur, le retrait.
 *
 * Le contenu devient inerte : on n'a pas envie de cocher une tâche en
 * réorganisant, et une carte qui réagit au clic pendant qu'on la déplace donne
 * l'impression d'avoir raté son geste.
 *
 * En `variant="overlay"`, c'est la copie qui suit le pointeur : elle ne porte
 * plus aucun contrôle. Un second jeu de boutons vivrait hors de la grille, et la
 * poignée y serait une cible clavier fantôme.
 */
type WidgetFrameProps = {
  widget: WidgetInstance
  dragging: boolean
  variant?: 'edit' | 'overlay'
  handleProps?: DragHandleProps
  onSetSpan?: (span: WidgetSpan) => void
  onRemove?: () => void
  children: ReactNode
}

export function WidgetFrame({
  widget,
  dragging,
  variant = 'edit',
  handleProps,
  onSetSpan,
  onRemove,
  children,
}: WidgetFrameProps) {
  const spans = spansOf(widgetDef(widget.id))
  const label = widgetLabel(widget)
  const overlay = variant === 'overlay'

  return (
    <div
      className={cn(
        'rounded-2xl bg-canvas p-1.5 ring-[1.5px] ring-border-strong transition-opacity duration-150',
        dragging && 'opacity-35',
        // La copie remplit le gabarit mesuré par dnd-kit : sans `h-full` elle
        // reprendrait la hauteur de son contenu et rétrécirait sous le pointeur.
        overlay && 'h-full shadow-modal ring-primary',
      )}
    >
      <div className="mb-1 flex items-center gap-2 px-1.5 pt-0.5">
        {overlay ? (
          <span aria-hidden className="shrink-0 px-0.5 text-[12px] leading-none text-primary">
            ⠿
          </span>
        ) : (
          handleProps && (
            <DragHandle
              label={`Déplacer « ${label} »`}
              handleProps={handleProps}
              active={dragging}
            />
          )
        )}

        {/* Pas de titre ici : chaque widget porte déjà le sien, et deux
            libellés empilés se lisent comme un bug d'affichage. Le nom reste
            dans les libellés accessibles de la poignée et du retrait. */}
        <span className="flex-1" />

        {/* La largeur n'existe qu'à partir de trois colonnes : sous `lg`,
            l'accueil n'en a qu'une et le réglage ne voudrait rien dire. */}
        {!overlay && spans.length > 1 && onSetSpan && (
          <div className="hidden lg:block">
            <SegmentedGroup
              label={`Largeur de « ${label} »`}
              value={String(widget.span)}
              onChange={(value) => onSetSpan(Number(value) as WidgetSpan)}
              options={spans.map((span) => ({
                value: String(span),
                label: SPAN_LABELS[span],
              }))}
            />
          </div>
        )}

        {!overlay && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Retirer « ${label} »`}
            className={cn(
              'shrink-0 cursor-pointer rounded-sm px-2 py-1 text-label font-medium text-ink-muted',
              'transition-colors duration-150 hover:bg-danger-bg hover:text-danger',
              'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
            )}
          >
            Retirer
          </button>
        )}
      </div>

      {/* `inert` plutôt qu'`aria-hidden` : il retire aussi le contenu du
          parcours clavier. Une carte masquée aux lecteurs d'écran mais toujours
          tabulable serait pire que rien.

          Il n'enveloppe QUE le contenu, jamais la barre d'outils : la poignée
          doit rester focalisable, sinon le chemin clavier disparaît. */}
      <div inert className="pointer-events-none">
        {children}
      </div>
    </div>
  )
}
