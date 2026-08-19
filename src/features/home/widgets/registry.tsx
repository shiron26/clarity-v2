// Le catalogue des widgets : ce qu'on peut poser sur l'accueil, à quelle
// largeur, et comment ça se rend.
//
// Un descripteur plutôt qu'une cascade de `if` dispersés — même parti pris que
// `features/objectives/detailLayout.ts`. C'est aussi le SEUL `switch` sur
// `WidgetId` du code : tout le reste passe par ces définitions.
import type { ReactNode } from 'react'
import { MEMO_GLYPH, MEMO_TINT } from './glyphs'
import type { MemoKind, WidgetId, WidgetInstance, WidgetSpan } from '../dashboardLayout'
import { MEMO_KINDS } from '../dashboardLayout'
import { RitualWidget } from './RitualWidget'
import { WeekWidget } from './WeekWidget'
import { InboxWidget } from './InboxWidget'
import { MemoWidget } from './MemoWidget'
import { HorizonWidget } from './HorizonWidget'
import { MilestonesWidget } from './MilestonesWidget'

export type WidgetDef = {
  id: WidgetId
  label: string
  /** Ce que le widget montre, en une phrase : c'est ce qu'on lit dans la palette. */
  hint: string
  defaultSpan: WidgetSpan
  /** Le widget sait-il s'afficher sur un téléphone ? */
  mobile: boolean
}

/**
 * Les largeurs offertes à un widget.
 *
 * Un widget qui tient sur un téléphone tient dans un tiers d'écran : les trois
 * largeurs lui sont ouvertes. Seul un widget qu'on masque en mobile peut se
 * contenter de deux tiers et de la pleine largeur. La règle est dérivée plutôt que
 * recopiée widget par widget, où elle finissait par diverger.
 */
export function spansOf(def: WidgetDef): WidgetSpan[] {
  return def.mobile ? [1, 2, 3] : [2, 3]
}

export const WIDGET_DEFS: WidgetDef[] = [
  {
    id: 'ritual',
    label: 'Le rituel',
    hint: 'Le rendez-vous du vendredi, et le temps qu’il reste avant',
    defaultSpan: 3,
    mobile: true,
  },
  {
    id: 'horizon',
    label: 'L’horizon',
    hint: 'L’année, le jour où vous en êtes, et la date où vos objectifs se terminent',
    defaultSpan: 3,
    mobile: true,
  },
  {
    id: 'week',
    label: 'Votre semaine',
    hint: 'Les sept jours, ce qui est dû chacun, et le retard à côté',
    defaultSpan: 3,
    mobile: true,
  },
  {
    id: 'inbox',
    label: 'À trier',
    hint: 'Ce que vous avez noté sans date ni liste, et de quoi en noter plus',
    defaultSpan: 1,
    mobile: true,
  },
  {
    id: 'milestones',
    label: 'Étapes en cours',
    hint: 'Les étapes du trimestre, tous objectifs confondus',
    defaultSpan: 1,
    mobile: true,
  },
  {
    id: 'memo',
    label: 'Aide-mémoire',
    hint: 'Une liste sans échéance, à remplir d’une ligne',
    defaultSpan: 1,
    mobile: true,
  },
]

const BY_ID = new Map(WIDGET_DEFS.map((def) => [def.id, def]))

export function widgetDef(id: WidgetId): WidgetDef {
  const def = BY_ID.get(id)
  if (!def) throw new Error(`Widget inconnu : ${id}`)
  return def
}

/** Le nom d'un aide-mémoire dans la palette, avant que sa liste soit chargée. */
export const MEMO_LABELS: Record<MemoKind, string> = {
  courses: 'Courses',
  idees: 'Idées',
  notes: 'Pense-bête',
}

export const MEMO_ENTRIES = MEMO_KINDS.map((kind) => ({
  kind,
  label: MEMO_LABELS[kind],
  icon: MEMO_GLYPH[kind],
  tint: MEMO_TINT[kind],
}))

/** Le titre affiché dans la palette et par le mode Organiser. */
export function widgetLabel(widget: WidgetInstance): string {
  if (widget.id === 'memo' && widget.memo) return MEMO_LABELS[widget.memo]
  return widgetDef(widget.id).label
}

/**
 * Le seul `switch` sur `WidgetId` du code. Chaque widget reçoit sa largeur : à un
 * tiers, les plus larges se replient comme sur téléphone, et un point de rupture
 * ne suffirait pas à le leur dire.
 */
export function renderWidget(widget: WidgetInstance): ReactNode {
  switch (widget.id) {
    case 'ritual':
      return <RitualWidget />
    case 'horizon':
      return <HorizonWidget />
    case 'week':
      return <WeekWidget span={widget.span} />
    case 'inbox':
      return <InboxWidget />
    case 'milestones':
      return <MilestonesWidget />
    // `memo` sans nature ne franchit pas la validation de `readLayout` : le cas
    // n'existe qu'ici, pour que le `switch` reste exhaustif.
    case 'memo':
      return widget.memo ? <MemoWidget kind={widget.memo} /> : null
  }
}
