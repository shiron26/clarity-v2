import type { ReactNode } from 'react'
import { WidgetGlyph } from './WidgetGlyph'

/**
 * L'en-tête d'une carte à trois places : pastille + titre à gauche, méta et action
 * à droite. Celui des widgets de l'accueil (`WidgetCard`) et des cartes de « Ma
 * journée » : un seul dessin, pour que les deux écrans se lisent de la même façon.
 */
export function CardHeader({
  title,
  icon,
  iconColor,
  meta,
  action,
}: {
  title: string
  /** Un glyphe au trait, posé dans sa pastille. */
  icon?: ReactNode
  /** Teinte de la pastille (couleur de liste, une donnée). Grise sans elle. */
  iconColor?: string | null
  /** Une ligne de contexte à droite du titre : dates, décompte, total. */
  meta?: ReactNode
  /** Lien ou bouton, aligné à droite après la méta. */
  action?: ReactNode
}) {
  return (
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
  )
}
