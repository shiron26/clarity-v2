import type { ReactNode } from 'react'
import { SECTION_LABEL } from '../../../components/ui/sectionLabel'
import { cn } from '../../../lib/cn'

export type RhythmStat = {
  /** « 3/3 », « 83 % », « + 550 € », « — ». */
  value: string
  label: string
  /** Couleur dynamique du slot ; blanc par défaut. */
  color?: string
}

type ObjectiveRhythmBandProps = {
  /** « Régularité · T3 », « Vos relevés », « Vos saisies ». */
  title: string
  stats: RhythmStat[]
  /** Le graphique — un seul par objectif. */
  children?: ReactNode
  footnote?: string
}

/**
 * Bande 3 — **est-ce que je tiens le rythme**.
 *
 * La coquille sombre : un titre, deux chiffres, **un** graphique, une note.
 * Aucune légende, aucun paragraphe d'explication — la version précédente en
 * portait trois, et ils noyaient le chiffre qu'ils prétendaient éclairer
 * (REFONTE §4). Les nuances visuelles restent, elles n'ont pas besoin d'être
 * commentées.
 *
 * Un objectif jalonné ne rend pas cette bande du tout : des étapes n'ont pas de
 * rythme, et l'absence du bloc dit la règle mieux qu'une phrase.
 */
export function ObjectiveRhythmBand({
  title,
  stats,
  children,
  footnote,
}: ObjectiveRhythmBandProps) {
  return (
    <section className="bg-night px-5.5 py-5 text-white">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h3 className={cn(SECTION_LABEL, 'text-ink-onnight')}>
          {title}
        </h3>
        <div className="flex gap-6">
          {stats.map((stat) => (
            <div key={stat.label} className="text-right">
              <div
                className="text-title leading-none font-semibold"
                style={stat.color ? { color: stat.color } : undefined}
              >
                {stat.value}
              </div>
              <div className="mt-1 text-micro text-ink-onnight">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {children && <div className="mt-6">{children}</div>}

      {footnote && <p className="mt-3.5 text-caption text-ink-onnight">{footnote}</p>}
    </section>
  )
}
