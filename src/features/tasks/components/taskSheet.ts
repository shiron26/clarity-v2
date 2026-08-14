import { addDays, formatDayMonth, type IsoDate } from '../../../lib/appDate'
import { cn } from '../../../lib/cn'

// Classes et libellés partagés par les deux modales de tâche (création et
// édition), qui suivent la même maquette. Ils vivent hors des composants : un
// fichier qui n'exporte pas que des composants casse le fast refresh.

/** Libellé du déclencheur d'échéance — « ☀ Aujourd'hui », « 13 août », « ⃠ Sans date ». */
export function dueLabelOf(dueDate: IsoDate | null, today: IsoDate): string {
  if (dueDate === null) return '⃠ Sans date'
  if (dueDate === today) return '☀ Aujourd’hui'
  if (dueDate === addDays(today, 1)) return '→ Demain'
  return formatDayMonth(dueDate)
}

/** Surtitre de section — « OBJECTIF », « LISTE », « ÉCHÉANCE »… */
export const SHEET_LABEL = 'text-[10px] font-semibold tracking-[1.2px] text-ink-muted'

/**
 * Ligne dépliable des feuilles mobiles : 52 px de haut, bien au-dessus des 44 px
 * de cible tactile minimale.
 */
export const DISCLOSURE_ROW = cn(
  'flex min-h-[52px] w-full cursor-pointer items-center gap-2.5 rounded-panel bg-canvas px-[15px] py-3.5',
  'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
)

/** Champ titre : 14 px en feuille, 13.5 px une fois la modale posée en desktop. */
export const TITLE_INPUT = cn(
  'min-w-0 flex-1 rounded-panel border-[1.5px] border-border bg-canvas p-[15px] text-[14px] text-ink outline-none',
  'placeholder:text-placeholder focus:border-primary focus:bg-surface',
  'sm:rounded-lg sm:px-3.5 sm:py-3 sm:text-[13.5px]',
)

/** Bouton ⚑ posé à droite du titre, mobile uniquement. */
export function importantButtonClass(active: boolean) {
  return cn(
    'flex w-[52px] shrink-0 cursor-pointer items-center justify-center rounded-panel border-[1.5px] text-[17px]',
    'transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none sm:hidden',
    active ? 'border-[#a9beff] bg-danger-bg text-danger' : 'border-border bg-canvas text-ink-muted',
  )
}
