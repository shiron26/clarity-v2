import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

/**
 * Libellé et aide d'un champ composé — ceux que `Field` ne couvre pas parce que
 * le contrôle n'est pas un `input` nu (un `SegmentedGroup`, un `UnitField`, une
 * paire select + champ libre).
 *
 * Partagés plutôt que locaux à l'onboarding : le formulaire d'objectif de
 * l'écran Objectifs pose exactement les mêmes questions, et une feature ne peut
 * pas importer d'une autre (AGENTS.md).
 */

/**
 * Le libellé d'un champ, au-dessus du contrôle.
 *
 * Sans `htmlFor` il sert aussi de **titre de bloc** — le cas d'un groupe de
 * cartes ou de deux champs qui se partagent une même question. Pointer deux
 * libellés vers le même `id` serait pire que ne pas en pointer du tout.
 */
export function FieldLabel({
  children,
  optional = false,
  htmlFor,
  className,
}: {
  children: ReactNode
  optional?: boolean
  htmlFor?: string
  className?: string
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn('mb-[7px] block text-label font-medium text-ink-2', className)}
    >
      {children}
      {optional && <span className="font-normal text-ink-muted"> (facultatif)</span>}
    </label>
  )
}

/** L'aide sous un champ : une précision, jamais une consigne. */
export function FieldHint({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p className={cn('mt-[7px] text-[11px] leading-relaxed text-ink-muted', className)}>
      {children}
    </p>
  )
}
