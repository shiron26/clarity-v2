import { MeasureIcon } from '../../../components/objectives/MeasureIcon'
import { cn } from '../../../lib/cn'
import { maskTitle } from '../../../lib/objectivePalette'
import { HEAT_STEPS } from '../../../lib/objectiveState'
import type { QuarterLine } from '../quarterLines'

/**
 * L'opacité d'une case remplie, sur fond clair.
 *
 * `skin.core` et non `skin.ramp` : la rampe est calibrée pour le fond nuit, ses
 * crans hauts sont presque invisibles sur blanc. `core` est la couleur pleine du
 * slot — celle dont `ObjectiveHero` remplit déjà sa jauge. Plafonnée bien en
 * dessous de 1 : une période mensuelle occupe un tiers de la piste, et à pleine
 * saturation elle crierait plus fort que le chiffre juste à côté.
 */
function fillOpacity(level: number): number {
  return 0.14 + (level / (HEAT_STEPS - 1)) * 0.46
}

/**
 * La colonne des chiffres est **figée**, pas dimensionnée par son contenu.
 *
 * Laissée en `auto`, elle change de largeur d'une ligne à l'autre — « 20 séances »
 * n'occupe pas la même place que « + 7 » — et les frises finissent à des abscisses
 * différentes. Or c'est précisément en les alignant qu'on peut comparer deux
 * rythmes d'un coup d'œil.
 */
export const QUARTER_GRID =
  'grid grid-cols-[minmax(0,1fr)_140px] gap-x-5 lg:grid-cols-[minmax(0,1fr)_176px] lg:gap-x-6'

type ObjectiveQuarterRowProps = {
  line: QuarterLine
  privacy: boolean
}

/**
 * Un objectif, sur une ligne : son titre et son chiffre au premier étage, son
 * rythme et le détail au second.
 *
 * Le titre n'est écrit **qu'une fois**, et en entier — la frise et les chiffres
 * vivaient auparavant dans deux blocs séparés, ce qui obligeait l'œil à recoller
 * les deux moitiés d'un même objet. La frise y gagne aussi en largeur : le titre
 * étant passé au-dessus, il ne lui mange plus 190 px sur sa gauche.
 */
export function ObjectiveQuarterRow({ line, privacy }: ObjectiveQuarterRowProps) {
  const { objective, skin, secondary, cells, value, detail } = line

  return (
    <div
      className={cn(
        QUARTER_GRID,
        'items-baseline gap-y-2 border-b border-surface-subtle py-4 last:border-b-0',
        // Un secondaire s'atténue : on n'est pas censé le surveiller.
        secondary && 'opacity-78',
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={cn('shrink-0 rounded-full', secondary ? 'size-[5px]' : 'size-[7px]')}
          style={{ backgroundColor: skin.hue }}
        />
        <MeasureIcon measure={objective.measure} />
        <span className="truncate text-ui font-medium text-ink-2" title={objective.title}>
          {privacy ? maskTitle(objective.title) : objective.title}
        </span>
      </div>

      <p className="text-right text-[19px] leading-none font-semibold whitespace-nowrap">
        {value}
      </p>

      <div className="flex gap-[3px]">
        {cells.map((cell, i) => {
          if (cell.kind === 'outside') return <span key={i} className="flex-1" />
          // Une période à venir est un contour, jamais un bloc plein — sinon elle
          // se lit comme une période ratée.
          if (cell.kind === 'future') {
            return (
              <span
                key={i}
                className="h-5 flex-1 rounded-[3px] border border-dashed border-border-strong"
              />
            )
          }
          return (
            <span
              key={i}
              className={cn('h-5 flex-1 rounded-[3px]', cell.level === 0 && 'bg-field')}
              style={
                cell.level > 0
                  ? { backgroundColor: skin.core, opacity: fillOpacity(cell.level) }
                  : undefined
              }
            />
          )
        })}
      </div>

      <p className="text-right text-label text-ink-muted">{detail}</p>
    </div>
  )
}
