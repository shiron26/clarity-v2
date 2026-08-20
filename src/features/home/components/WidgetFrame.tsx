import type { ReactNode } from 'react'
import { cn } from '../../../lib/cn'
import { SegmentedGroup } from '../../../components/ui/SegmentedGroup'
import { IconButton } from '../../../components/ui/IconButton'
import { MinusIcon } from '../../../components/icons/MinusIcon'
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
        {/* La poignée en pastille (`tone="solid"`), et elle seule ici : dans un
            mode où déplacer EST le travail, la poignée d'une ligne de liste
            passait pour un décor et personne ne trouvait le geste. La copie qui
            suit le pointeur reprend la même forme, sinon on ne reconnaît pas ce
            qu'on vient de saisir. */}
        {overlay ? (
          <span
            aria-hidden
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-sm bg-primary-soft text-[14px] leading-none text-primary"
          >
            ⠿
          </span>
        ) : (
          handleProps && (
            <DragHandle
              label={`Déplacer « ${label} »`}
              handleProps={handleProps}
              active={dragging}
              tone="solid"
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

        {/* Un « moins », pas un mot : le CTA texte pesait autant que le réglage
            de largeur juste à côté, pour une action qu'on fait une fois. Le
            libellé reste entier dans l'infobulle et pour les lecteurs d'écran,
            sans quoi l'icône devient une devinette. */}
        {!overlay && onRemove && (
          <IconButton
            label={`Retirer « ${label} »`}
            onClick={onRemove}
            className="shrink-0 bg-transparent text-ink-muted hover:bg-danger-bg hover:text-danger"
          >
            <MinusIcon className="size-4" />
          </IconButton>
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
