import { DeckCard } from '../../../components/ritual/DeckCard'
import { DeckHeading } from '../../../components/ritual/DeckHeading'
import { objectiveSkinOf } from '../../../lib/objectivePalette'
import type { ProjectionLine } from '../ritualContent'
import { DeckAction } from '../../../components/ritual/DeckAction'

type RitualProjectionProps = {
  lines: ProjectionLine[]
  /** Régularité sur les 4 périodes closes, en % — `null` si rien n'est encore mesuré. */
  regularity: number | null
  /** La même, période en cours incluse : ce que la séance vient de changer. */
  projected: number | null
  onClose: () => void
}

/**
 * L'écran 5 — ce que le rituel rend.
 *
 * **Sans lui, l'application ne fait que prendre.** Les quatre écrans précédents
 * demandent : réparer, trier, choisir. Celui-ci transforme le pointage en
 * prévision, et montre l'arithmétique de la régularité en une ligne — une
 * période sort de la fenêtre, une autre entre.
 *
 * Il est hors du décompte des étapes (pas de pastilles) : ce n'est pas une
 * question de plus, c'est la contrepartie.
 */
export function RitualProjection({
  lines,
  regularity,
  projected,
  onClose,
}: RitualProjectionProps) {
  // On n'écrit le delta que s'il y a bien deux chiffres ET qu'ils diffèrent :
  // « 75 % → 75 % » donnerait l'impression d'une promesse non tenue.
  const showDelta = regularity !== null && projected !== null && projected !== regularity

  return (
    <>
      <DeckHeading eyebrow="Rituel terminé">À ce rythme</DeckHeading>

      <div className="mt-6.5 flex w-full flex-col gap-2.5">
        {lines.map(({ objective, value, date }, index) => {
          const skin = objectiveSkinOf(objective)
          return (
            <DeckCard key={objective.id} index={index} className="flex items-center gap-3">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: skin.hue }}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-body text-ink-onnight-strong">
                  {objective.title}
                </span>
                <span className="truncate text-caption text-ink-onnight-faint">{value}</span>
              </span>
              <span
                className="shrink-0 text-body font-semibold"
                // Pas de date : gris muet. Annoncer « jamais » serait un jugement,
                // et l'écran n'en porte aucun.
                style={{ color: date === null ? undefined : skin.hue }}
              >
                {date ?? '—'}
              </span>
            </DeckCard>
          )
        })}
      </div>

      {showDelta && (
        <p className="animate-slide-up mt-5.5 text-body text-ink-onnight">
          Régularité{' '}
          <span className="text-ink-onnight-faint line-through">{regularity} %</span> →{' '}
          <span className="font-semibold text-white">{projected} %</span>
        </p>
      )}

      <DeckAction
        onClick={onClose}
        className="mt-6.5"
      >
        Revenir au dashboard
      </DeckAction>

      <p className="animate-slide-up mt-4 text-body text-ink-onnight-faint">
        À dimanche prochain.
      </p>
    </>
  )
}
