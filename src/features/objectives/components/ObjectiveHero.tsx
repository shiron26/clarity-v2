import { Button } from '../../../components/ui/Button'
import type { ProjectionLine } from '../heroContent'

type ObjectiveHeroProps = {
  /** Le grand chiffre, déjà formaté : « 4 400 € », « 62 », « 2 ». */
  value: string
  /** « 6 000 € », « 100 séances », « 4 étapes ». `null` = héros nu. */
  of: string | null
  /** Suffixe quand il n'y a pas de « sur » : « séances faites ». */
  suffix: string | null
  /** 0–100. `null` = ni barre ni pourcentage. */
  percent: number | null
  /** Couleur du slot — dynamique, donc en style inline. */
  color: string
  projection: ProjectionLine | null
  action?: { label: string; onClick: () => void }
}

/**
 * Bande 2 — **où j'en suis**.
 *
 * Ce composant ne connaît **ni `measure`, ni `Objective`** : il reçoit des
 * chaînes déjà formées. C'est ce qui lui permet de servir les cinq états sans
 * un seul test sur le type de l'objectif — le choix a été fait une fois, dans
 * `heroContent`.
 */
export function ObjectiveHero({
  value,
  of,
  suffix,
  percent,
  color,
  projection,
  action,
}: ObjectiveHeroProps) {
  const hasBar = percent !== null

  return (
    <div className="border-t border-surface-subtle px-5.5 py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="min-w-0">
          <span className="text-[32px] leading-none font-semibold tracking-[-0.5px]">{value}</span>
          {of && <span className="ml-2 text-body text-ink-muted">sur {of}</span>}
          {!of && suffix && <span className="ml-2 text-body text-ink-muted">{suffix}</span>}
        </p>
        {hasBar && (
          <span className="shrink-0 text-ui font-semibold" style={{ color }}>
            {percent} %
          </span>
        )}
      </div>

      {hasBar && (
        <div className="mt-3 h-2 overflow-hidden rounded-xs bg-field">
          <div
            className="h-full rounded-xs transition-[width] duration-500"
            style={{ width: `${percent}%`, backgroundColor: color }}
          />
        </div>
      )}

      {(projection || action) && (
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
          {projection ? (
            <p className="min-w-0 text-caption text-ink-2">
              {projection.lead}
              <b className="font-semibold">{projection.strong}</b>
              {projection.tail}
            </p>
          ) : (
            <span />
          )}
          {action && (
            <Button size="sm" onClick={action.onClick} className="shrink-0">
              {action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
