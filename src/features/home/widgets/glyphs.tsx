import type { ReactNode } from 'react'
import { RocketIcon } from '../../../components/icons/RocketIcon'
import { HorizonIcon } from '../../../components/icons/HorizonIcon'
import { WeekIcon } from '../../../components/icons/WeekIcon'
import { StepsIcon } from '../../../components/icons/StepsIcon'
import { TrayIcon } from '../../../components/icons/TrayIcon'
import { CartIcon } from '../../../components/icons/CartIcon'
import { BulbIcon } from '../../../components/icons/BulbIcon'
import { NoteIcon } from '../../../components/icons/NoteIcon'
import type { MemoKind, WidgetId } from '../dashboardLayout'

/**
 * Le glyphe de chaque widget, en un seul endroit.
 *
 * Il paraît deux fois — en tête de la carte et dans la palette d'ajout — et ce
 * doit être le même des deux côtés : une palette qui montrerait autre chose que
 * ce qu'on va poser n'apprendrait rien.
 *
 * Ce module est une FEUILLE : le registre le lit, les widgets aussi. Les faire
 * passer par le registre fermerait un cycle d'imports (le registre les importe
 * déjà) et rendrait un écran blanc.
 *
 * Le rituel n'a pas de pastille sur sa carte — un fond nuit n'en a pas besoin —
 * mais il lui en faut une dans la palette, où toutes les lignes se valent.
 */
export const WIDGET_GLYPH: Record<WidgetId, ReactNode> = {
  // La fusée plutôt que la flèche de tendance : c'est l'échelle du rituel, et
  // la flèche se confondait avec l'escalier des étapes à 16 px.
  ritual: <RocketIcon className="size-4" />,
  horizon: <HorizonIcon />,
  week: <WeekIcon />,
  inbox: <TrayIcon />,
  milestones: <StepsIcon />,
  memo: <CartIcon />,
}

/** Trois aide-mémoire, trois glyphes : ce sont trois listes, pas une. */
export const MEMO_GLYPH: Record<MemoKind, ReactNode> = {
  courses: <CartIcon />,
  idees: <BulbIcon />,
  notes: <NoteIcon />,
}

/**
 * Leurs teintes, prises dans la palette des listes (`DESIGN.md` : on n'en sort
 * pas). Une couleur se repère de plus loin qu'un glyphe, et de bien plus loin
 * qu'un titre.
 */
export const MEMO_TINT: Record<MemoKind, string> = {
  courses: '#00b862',
  idees: '#f5a524',
  notes: '#8f9bde',
}
