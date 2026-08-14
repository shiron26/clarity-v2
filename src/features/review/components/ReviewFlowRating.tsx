import { useEffect, useRef, useState } from 'react'
import { RocketRating } from './RocketRating'
import { cn } from '../../../lib/cn'
import { objectiveSkin } from '../../../lib/objectivePalette'
import { MAX_COMMENT, RATING_COLORS, type Rating } from '../../../lib/reviewRating'
import type { Objective } from '../../../hooks/useObjectives'

type ReviewFlowRatingProps = {
  objective: Objective
  index: number
  total: number
  rating: number | null
  comment: string
  /** Cases de la semaine notée ; absentes au bilan trimestriel. */
  cells: boolean[] | null
  daily: boolean
  stat: string
  /** Notes du trimestre dans l'ordre des semaines — la sparkline. */
  sparkline: (number | undefined)[]
  quarter: number
  nextLabel: string
  hasPrev: boolean
  onRate: (rating: Rating) => void
  onCommentCommit: (comment: string) => void
  onPrev: () => void
  onNext: () => void
}

/**
 * Le geste de la review : un objectif à la fois, sa semaine sous les yeux.
 *
 * Rien n'est mis en attente d'un bouton « enregistrer » — la note part dès le
 * clic, le commentaire dès qu'on quitte le champ. Quitter le flow en cours de
 * route ne perd donc rien, et « tout est librement modifiable après coup »
 * (SPEC §4.4) reste vrai à la seconde près.
 */
export function ReviewFlowRating({
  objective,
  index,
  total,
  rating,
  comment,
  cells,
  daily,
  stat,
  sparkline,
  quarter,
  nextLabel,
  hasPrev,
  onRate,
  onCommentCommit,
  onPrev,
  onNext,
}: ReviewFlowRatingProps) {
  const skin = objectiveSkin(objective.slot)
  const [draft, setDraft] = useState(comment)
  const touched = useRef(false)

  // Le champ se remplit quand le commentaire arrive du serveur, mais plus après
  // la première frappe : noter une fusée rafraîchit la session, et une saisie en
  // cours ne doit pas être écrasée par ce rafraîchissement. Le remontage par
  // `key` sur l'objectif remet naturellement l'état à zéro d'une carte à l'autre.
  useEffect(() => {
    if (!touched.current) setDraft(comment)
  }, [comment])

  const canNext = rating !== null

  return (
    <div className="animate-slide-up flex flex-1 flex-col items-center justify-center text-center">
      <p className="text-[9.5px] font-semibold tracking-[1.4px] text-ink-onnight lg:text-[10px] lg:tracking-[1.5px]">
        OBJECTIF {index + 1}/{total}
      </p>
      <h2 className="mt-2.5 text-[18px] leading-snug font-semibold text-white lg:text-[22px]">
        {objective.title}
      </h2>

      {cells && cells.length > 0 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {cells.map((filled, i) => (
            <span
              key={i}
              className="size-[13px]"
              style={{
                borderRadius: daily ? 4 : '50%',
                ...(filled
                  ? {
                      backgroundImage: `linear-gradient(145deg,${skin.ramp[2]},${skin.ramp[0]})`,
                      boxShadow: `0 0 12px ${skin.ramp[1]}66`,
                    }
                  : { backgroundColor: 'rgb(255 255 255 / 0.1)' }),
              }}
            />
          ))}
        </div>
      )}

      <p className="mt-1.5 text-[10px] text-ink-onnight lg:text-caption">{stat}</p>

      <RocketRating value={rating} onChange={onRate} />

      <div className="w-full max-w-95 text-left">
        <label className="sr-only" htmlFor={`review-comment-${objective.id}`}>
          Notes sur {objective.title}
        </label>
        <textarea
          id={`review-comment-${objective.id}`}
          rows={2}
          maxLength={MAX_COMMENT}
          value={draft}
          onChange={(e) => {
            touched.current = true
            setDraft(e.target.value)
          }}
          onBlur={() => {
            if (draft !== comment) onCommentCommit(draft)
          }}
          placeholder="Notes sur la semaine…"
          className="w-full resize-none border-0 border-b border-white/14 bg-transparent px-0.5 py-2 text-[12px] text-[#f0f1f7] outline-none placeholder:text-ink-onnight focus:border-b-[#2f7bff]"
        />
        <p className="mt-1 text-right text-micro text-[#565866]">
          {draft.length}/{MAX_COMMENT}
        </p>
      </div>

      <div className="mt-5 flex flex-col items-center gap-1.5">
        <div className="flex h-6.5 items-end gap-1">
          {sparkline.map((value, i) => (
            <span
              key={i}
              className="w-2.5 shrink-0 self-end rounded-xs"
              style={{
                height: value ? value * 7 + 3 : 3,
                backgroundColor: value ? RATING_COLORS[value] : 'rgb(255 255 255 / 0.12)',
                boxShadow: value === 3 ? `0 0 8px ${RATING_COLORS[3]}66` : undefined,
              }}
            />
          ))}
        </div>
        <span className="text-[8.5px] tracking-[1px] text-[#565866]">ÉVOLUTION Q{quarter}</span>
      </div>

      <div className="mt-6 flex items-center gap-4">
        {hasPrev && (
          <button
            type="button"
            onClick={onPrev}
            className="cursor-pointer rounded-xs p-2 text-[11px] text-ink-onnight hover:text-white focus-visible:ring-3 focus-visible:ring-white/30 focus-visible:outline-none"
          >
            ← Précédent
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          className={cn(
            'rounded-lg px-6.5 py-3 text-body font-medium text-white transition-all duration-200',
            'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
            canNext
              ? 'cursor-pointer bg-primary shadow-[0_8px_20px_rgb(0_68_224_/_0.35)] hover:-translate-y-px hover:bg-primary-hover active:translate-y-px active:bg-primary-active'
              : 'cursor-not-allowed bg-[#34364a] text-ink-onnight',
          )}
        >
          {nextLabel}
        </button>
      </div>
    </div>
  )
}
