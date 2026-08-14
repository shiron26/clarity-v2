import type { CSSProperties } from 'react'

type ObjectivePreviewCardProps = {
  title: string
  meta: string
  done: number
  target: number
  /** Dégradé de fond de la carte. */
  gradient: string
  /** Couleur pleine du disque central. */
  core: string
}

// Aperçu décoratif d'une carte objectif à anneau (panneau d'auth uniquement).
export function ObjectivePreviewCard({
  title,
  meta,
  done,
  target,
  gradient,
  core,
}: ObjectivePreviewCardProps) {
  const pct = Math.round((done / target) * 100)

  return (
    <div
      className="flex flex-col rounded-[14px] px-4 py-[15px]"
      style={{ backgroundImage: gradient }}
    >
      <div className="flex items-baseline justify-between gap-2.5">
        <span className="text-body leading-tight font-semibold text-white">{title}</span>
        <span className="shrink-0 rounded-2xl bg-white/22 px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap text-white">
          {meta}
        </span>
      </div>

      <div className="mt-2 flex h-[62px] items-center justify-center">
        {/* conic-gradient : pas d'utilitaire Tailwind, on passe le pourcentage en variable CSS */}
        <div
          className="flex size-[62px] items-center justify-center rounded-full bg-[conic-gradient(#fff_var(--pct),rgba(255,255,255,.22)_var(--pct)_100%)]"
          style={{ '--pct': `${pct}%` } as CSSProperties}
        >
          <div
            className="flex size-12 items-center justify-center rounded-full"
            style={{ backgroundColor: core }}
          >
            <span className="text-[14px] font-semibold text-white">
              {done}
              <span className="text-[10px] text-white/65">/{target}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
