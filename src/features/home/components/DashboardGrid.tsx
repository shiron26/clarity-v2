import { useCallback, useMemo } from 'react'
import { SortableContainer } from '../../../components/dnd/SortableContainer'
import { useDashboardLayout } from '../useDashboardLayout'
import type { WidgetId } from '../dashboardLayout'
import { renderWidget, widgetLabel } from '../widgets/registry'
import { SortableWidgetCell } from './SortableWidgetCell'
import { WidgetFrame } from './WidgetFrame'

/**
 * La grille de l'accueil : trois colonnes en desktop, une seule en mobile où les
 * largeurs ne s'appliquent pas.
 *
 * Une ligne peut rester incomplète (deux widgets « deux tiers » à la suite).
 * C'est assumé : `grid-auto-flow: dense` boucherait le trou en déplaçant
 * visuellement un widget sans changer son ordre réel, et le mode Organiser
 * deviendrait incompréhensible.
 *
 * Un widget ne rend jamais `null` : son enveloppe occuperait quand même sa
 * cellule. Un widget sans contenu dit une phrase calme.
 *
 * Taire un widget est donc une décision de la PAGE, jamais du widget : elle passe
 * les identifiants à retirer (`hidden`), et l'instance sort de la grille avant le
 * rendu — sans laisser sa cellule derrière elle. C'est ce qui permet au rituel de
 * s'effacer tant qu'un bilan de trimestre attend. Le filtre ne s'applique pas en
 * mode Organiser : on doit pouvoir déplacer et retirer ce qui est momentanément tu.
 */
export function DashboardGrid({
  editing,
  hidden = [],
}: {
  editing: boolean
  hidden?: WidgetId[]
}) {
  const { layout, removeWidget, setSpan, setOrder } = useDashboardLayout()

  // `hidden` est mémoïsé par la page : sans cela, un tableau neuf à chaque rendu
  // ferait repartir tout ce qui suit, jusqu'aux identifiants du glissement.
  const shown = useMemo(
    () => (editing ? layout : layout.filter((widget) => !hidden.includes(widget.id))),
    [layout, editing, hidden],
  )

  const keys = useMemo(() => shown.map((widget) => widget.key), [shown])
  const labelByKey = useMemo(
    () => new Map(shown.map((widget) => [widget.key, widgetLabel(widget)])),
    [shown],
  )
  const byKey = useMemo(() => new Map(shown.map((widget) => [widget.key, widget])), [shown])

  const labelOf = useCallback((key: string) => labelByKey.get(key) ?? 'Widget', [labelByKey])

  return (
    <SortableContainer
      ids={keys}
      labelOf={labelOf}
      onReorder={setOrder}
      disabled={!editing}
      layout="grid"
      renderOverlay={(key) => {
        const widget = byKey.get(key)
        if (!widget) return null
        return (
          <WidgetFrame widget={widget} variant="overlay" dragging={false}>
            {renderWidget(widget)}
          </WidgetFrame>
        )
      }}
    >
      {(order) => (
        // Pas d'`items-start` : les cellules s'étirent sur la hauteur de leur ligne,
        // et chaque carte la remplit. C'est ce qui aligne le bas des widgets voisins.
        <div className="grid min-w-0 grid-cols-1 gap-4.5 lg:grid-cols-3">
          {order.map((key) => {
            const widget = byKey.get(key)
            if (!widget) return null
            const rendered = renderWidget(widget)

            return (
              <SortableWidgetCell
                key={key}
                widgetKey={key}
                span={widget.span}
                editing={editing}
              >
                {({ isDragging, handleProps }) =>
                  editing ? (
                    <WidgetFrame
                      widget={widget}
                      dragging={isDragging}
                      handleProps={handleProps}
                      onSetSpan={(span) => setSpan(key, span)}
                      onRemove={() => removeWidget(key)}
                    >
                      {rendered}
                    </WidgetFrame>
                  ) : (
                    rendered
                  )
                }
              </SortableWidgetCell>
            )
          })}
        </div>
      )}
    </SortableContainer>
  )
}
