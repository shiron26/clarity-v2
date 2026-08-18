import type { ReactNode } from 'react'
import { DeckEyebrow } from './DeckEyebrow'

type DeckHeadingProps = {
  /** Sur-titre en capitales espacées : la période, ou l'état de la cérémonie. */
  eyebrow?: string
  children: ReactNode
  /** Une phrase, jamais un paragraphe — une cérémonie n'explique pas sa mécanique. */
  subtitle?: string
}

/**
 * Le haut d'un écran de cérémonie.
 *
 * Le sous-titre est volontairement limité à une phrase : les justifications
 * produit vivent dans SPEC-REFONTE.md, pas dans l'interface (§10, contrôle n°3).
 */
export function DeckHeading({ eyebrow, children, subtitle }: DeckHeadingProps) {
  return (
    <div className="animate-slide-up w-full">
      {eyebrow && (
        <DeckEyebrow>{eyebrow}</DeckEyebrow>
      )}
      <h2 className="mt-3 text-[19px] leading-snug font-semibold text-white lg:text-[22px]">
        {children}
      </h2>
      {subtitle && <p className="mt-2.5 text-body leading-relaxed text-ink-onnight">{subtitle}</p>}
    </div>
  )
}
