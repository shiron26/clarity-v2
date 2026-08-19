import { Modal } from '../../../components/ui/Modal'
import { isDuplicable, type MemoKind, type WidgetId, type WidgetInstance } from '../dashboardLayout'
import { MEMO_ENTRIES, WIDGET_DEFS, widgetDef } from '../widgets/registry'
import { WIDGET_GLYPH } from '../widgets/glyphs'
import { WidgetGlyph } from './WidgetGlyph'
import { cn } from '../../../lib/cn'

/**
 * La palette : ce qu'on peut encore ajouter.
 *
 * Un widget déjà posé n'y figure plus — sauf les aide-mémoire, dont chaque
 * nature est une entrée à part : Courses et Idées peuvent tenir côte à côte.
 */
type WidgetPickerModalProps = {
  open: boolean
  onClose: () => void
  layout: WidgetInstance[]
  onAdd: (id: WidgetId, memo?: MemoKind) => void
}

export function WidgetPickerModal({ open, onClose, layout, onAdd }: WidgetPickerModalProps) {
  const placed = new Set(layout.map((widget) => widget.id))
  const placedMemos = new Set(
    layout.filter((widget) => widget.id === 'memo').map((widget) => widget.memo),
  )

  const entries = [
    ...WIDGET_DEFS.filter((def) => !isDuplicable(def.id) && !placed.has(def.id)).map((def) => ({
      key: def.id,
      label: def.label,
      hint: def.hint,
      icon: WIDGET_GLYPH[def.id],
      tint: null as string | null,
      add: () => onAdd(def.id),
    })),
    ...MEMO_ENTRIES.filter((entry) => !placedMemos.has(entry.kind)).map((entry) => ({
      key: `memo:${entry.kind}`,
      label: entry.label,
      hint: widgetDef('memo').hint,
      icon: entry.icon,
      tint: entry.tint as string | null,
      add: () => onAdd('memo', entry.kind),
    })),
  ]

  return (
    <Modal open={open} onClose={onClose} title="Ajouter un widget">
      {entries.length === 0 ? (
        <p className="text-body text-ink-3">Tout est déjà sur votre accueil.</p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {entries.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => {
                entry.add()
                onClose()
              }}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors duration-150',
                'hover:bg-canvas focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
              )}
            >
              <WidgetGlyph icon={entry.icon} color={entry.tint} />
              <span className="min-w-0">
                <span className="block text-body font-medium text-ink">{entry.label}</span>
                <span className="mt-0.5 block text-caption text-ink-muted">{entry.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}
