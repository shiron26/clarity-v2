import type { ReactNode } from 'react'

type YearBannerProps = {
  year: number
  /** « Semaine 33 » sur l'année en cours, « Année terminée » sur une archive. */
  caption: string
  /**
   * Part de l'année écoulée. `null` sur une année révolue : « 100 % » n'apprend
   * rien, et `meta` prend sa place pour dire ce que l'année a porté.
   */
  percent: number | null
  meta: string
  children: ReactNode
}

/**
 * L'avancement de l'année est le repère principal du bandeau : gros chiffre à
 * droite, la frise en dessous.
 *
 * **Pas de barre de progression** — le trait orange de la frise marque déjà
 * aujourd'hui, la dédoubler serait du bruit (REFONTE §6).
 */
export function YearBanner({ year, caption, percent, meta, children }: YearBannerProps) {
  return (
    <section className="rounded-2xl bg-night px-3.5 py-4.5 text-white lg:px-6.5 lg:py-6">
      <div className="mb-4.5 flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-semibold tracking-[1.5px] text-ink-onnight uppercase">
          {year} · {caption}
        </p>

        {percent === null ? (
          <span className="text-right text-label text-ink-onnight">{meta}</span>
        ) : (
          <span className="flex shrink-0 items-baseline font-bold">
            <span className="text-[22px] leading-none lg:text-[26px]">{percent}</span>
            <span className="ml-0.5 text-[13px]">%</span>
            <span className="ml-1.5 text-label font-normal text-ink-onnight">
              de l’année
            </span>
          </span>
        )}
      </div>

      {children}
    </section>
  )
}
