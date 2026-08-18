import { Badge } from '../../../components/ui/Badge'
import { cn } from '../../../lib/cn'
import { maskTitle, objectiveSkinOf } from '../../../lib/objectivePalette'
import { ObjectiveActionsMenu } from './ObjectiveActionsMenu'
import type { Objective } from '../../../hooks/useObjectives'

type ObjectiveHeaderProps = {
  objective: Objective
  /** La ligne de méta, déjà composée par `heroContent`. */
  meta: string
  /** Pastille et titre éteints : l'objectif est arrêté. */
  dim?: boolean
  privacy?: boolean
  readOnly?: boolean
  onEdit: () => void
  onDeleted: () => void
}

/**
 * Bande 1 — **de quoi s'agit-il**.
 *
 * Une pastille, un titre, **une** ligne de méta, et les actions dans un `⋯`. La
 * version précédente portait trois pastilles de méta et deux boutons pleins :
 * l'identité de l'objectif y passait après son administration.
 */
export function ObjectiveHeader({
  objective,
  meta,
  dim = false,
  privacy = false,
  readOnly = false,
  onEdit,
  onDeleted,
}: ObjectiveHeaderProps) {
  const skin = objectiveSkinOf(objective)
  const title = privacy ? maskTitle(objective.title) : objective.title

  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-2 px-5.5 pt-4 pb-4">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span
          className={cn('size-[11px] shrink-0 rounded-full', dim && 'bg-border-strong')}
          style={dim ? undefined : { backgroundImage: skin.gradient }}
        />
        <h2
          className={cn(
            'min-w-0 flex-1 truncate text-title font-semibold',
            dim && 'text-ink-3',
          )}
        >
          {title}
        </h2>
        {dim && <Badge>Arrêté</Badge>}
      </div>

      {!readOnly && (
        <ObjectiveActionsMenu objective={objective} onEdit={onEdit} onDeleted={onDeleted} />
      )}

      <p className="w-full pl-[21px] text-caption text-ink-muted">{meta}</p>
    </div>
  )
}
