import { CalendarIcon } from '../../../components/icons/CalendarIcon'
import { SegmentedGroup } from '../../../components/ui/SegmentedGroup'
import { cn } from '../../../lib/cn'
import {
  WEEKDAYS,
  unitLabel,
  type RecurrencePreset,
} from '../../../lib/recurrence'

type RecurrenceEditorProps = {
  preset: RecurrencePreset
  interval: number
  weekdays: number[]
  onPresetChange: (preset: RecurrencePreset) => void
  onIntervalChange: (interval: number) => void
  onWeekdaysChange: (weekdays: number[]) => void
  /**
   * `segmented` = pastilles côte à côte (desktop). `list` = lignes empilées de
   * 50 px, comme toute feuille mobile : à cette largeur, cinq segments seraient
   * illisibles et sous la cible tactile.
   */
  variant?: 'segmented' | 'list'
}

// « Annuel » n'existe pas côté serveur : `buildRecurrence` l'encode en mois × 12,
// ce que `private.next_due` calcule exactement. Le « jour du mois » de la maquette,
// lui, n'a aucun équivalent — le serveur repart de la date de complétion (SPEC §4.3) —
// et il est donc absent : il aurait menti à l'utilisateur.
const PRESETS: Array<{ value: RecurrencePreset; label: string }> = [
  { value: 'none', label: 'Aucune' },
  { value: 'daily', label: 'Quotidien' },
  { value: 'weekly', label: 'Hebdo' },
  { value: 'monthly', label: 'Mensuel' },
  { value: 'yearly', label: 'Annuel' },
]

export function RecurrenceEditor({
  preset,
  interval,
  weekdays,
  onPresetChange,
  onIntervalChange,
  onWeekdaysChange,
  variant = 'segmented',
}: RecurrenceEditorProps) {
  function toggleWeekday(iso: number) {
    const selected = weekdays.includes(iso)
    // Une règle hebdomadaire sans aucun jour retombe sur « +7×interval » côté
    // serveur : on ne laisse pas vider la sélection.
    if (selected && weekdays.length === 1) return
    onWeekdaysChange(
      selected ? weekdays.filter((d) => d !== iso) : [...weekdays, iso].sort((a, b) => a - b),
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {variant === 'segmented' ? (
        <SegmentedGroup
          label="Récurrence"
          value={preset}
          onChange={onPresetChange}
          options={PRESETS}
        />
      ) : (
        <div
          role="radiogroup"
          aria-label="Récurrence"
          className="overflow-hidden rounded-panel border-[1.5px] border-border bg-surface"
        >
          {PRESETS.map((option) => {
            const selected = option.value === preset
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onPresetChange(option.value)}
                className={cn(
                  'flex min-h-[50px] w-full cursor-pointer items-center px-[15px] text-left text-ui',
                  'border-b border-surface-subtle last:border-b-0',
                  'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
                  selected ? 'font-semibold text-primary' : 'text-ink',
                )}
              >
                <span className="flex-1">{option.label}</span>
                <span aria-hidden className="text-body text-primary">
                  {selected ? '✓' : ''}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {preset !== 'none' && (
        <div className="animate-fade-in flex flex-col gap-3 rounded-panel bg-canvas p-3.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <label className="flex items-center gap-2.5 text-[12px] text-ink-3">
              Tous les
              <input
                type="number"
                min={1}
                value={interval}
                onChange={(event) =>
                  onIntervalChange(Math.max(1, Number.parseInt(event.target.value, 10) || 1))
                }
                className="w-14 rounded-sm border-[1.5px] border-border bg-surface px-2.5 py-2 text-[12.5px] text-ink outline-none focus:border-primary"
              />
            </label>
            <span className="text-[12px] text-ink-3">{unitLabel(preset, interval)}</span>
          </div>

          {preset === 'weekly' && (
            <fieldset className="flex flex-wrap gap-1.5">
              <legend className="sr-only">Jours de la semaine</legend>
              {WEEKDAYS.map((day) => {
                const selected = weekdays.includes(day.iso)
                return (
                  <button
                    key={day.iso}
                    type="button"
                    aria-pressed={selected}
                    aria-label={day.long}
                    onClick={() => toggleWeekday(day.iso)}
                    className={cn(
                      'flex size-[30px] shrink-0 cursor-pointer items-center justify-center rounded-full border text-[11px] font-semibold',
                      'transition-colors duration-150',
                      'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
                      selected
                        ? 'border-primary bg-primary text-white'
                        : 'border-border bg-canvas text-ink-3 hover:border-[#a9beff]',
                    )}
                  >
                    <span aria-hidden>{day.short}</span>
                  </button>
                )
              })}
            </fieldset>
          )}

          {preset === 'monthly' && (
            <p className="flex items-start gap-2 text-[11px] leading-relaxed text-ink-muted">
              <CalendarIcon className="mt-px size-3.5 shrink-0" />
              L’échéance suivante se calcule à partir du jour où vous cochez la tâche.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
