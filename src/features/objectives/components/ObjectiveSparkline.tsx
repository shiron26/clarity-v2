import { pointX, pointY, seriesBounds, type EntryMode, type SeriesPoint } from '../../../lib/objectiveSeries'

const VIEW_WIDTH = 300

type ObjectiveSparklineProps = {
  points: SeriesPoint[]
  /** Cadre la courbe : un cumul part de zéro, un relevé sur sa plage réelle. */
  mode: EntryMode | null
  /** Trait et aire — couleur dynamique du slot. */
  color: string
  /** Points de relevé, plus clairs que le trait. */
  dotColor: string
  /** Halo autour des points = le fond de la bande sombre, pour les détacher. */
  dotRing: string
  height?: number
  ariaLabel: string
  /** Étiquettes d'axe déjà formatées, réparties de gauche à droite. */
  labels?: string[]
}

/**
 * La courbe d'un objectif quantifié, **avec ses points de relevé visibles**.
 *
 * Un seul graphique par objectif : la version précédente montrait une courbe
 * cumulée *et* des barres mensuelles, qui répondaient toutes deux aux chiffres
 * déjà écrits au-dessus. Ici l'écart entre deux points dit à lui seul le rythme
 * — un trou, c'est une période sans saisie (REFONTE §4).
 *
 * **Les points ne sont pas dans le SVG**, et c'est structurel : le tracé s'étire
 * horizontalement (`preserveAspectRatio="none"`), ce qui transformerait des
 * cercles en ellipses. Ce sont des `span` positionnés en pourcentage — un
 * pourcentage ignore l'échelle du `viewBox`. Le trait, lui, garde son épaisseur
 * grâce à `vector-effect="non-scaling-stroke"`.
 */
export function ObjectiveSparkline({
  points,
  mode,
  color,
  dotColor,
  dotRing,
  height = 92,
  ariaLabel,
  labels,
}: ObjectiveSparklineProps) {
  if (points.length === 0) return null

  const bounds = seriesBounds(points, mode)
  const xy = points.map((p, i) => ({
    x: pointX(i, points.length) * VIEW_WIDTH,
    y: height - pointY(p.value, bounds) * height,
    left: pointX(i, points.length) * 100,
    bottom: pointY(p.value, bounds) * 100,
    point: p,
  }))

  // Un point seul n'a pas de segment à tracer : on ne dessine que sa pastille.
  const path =
    xy.length > 1
      ? xy.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
      : null

  return (
    <div>
      <div className="relative pt-1.5">
        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
          preserveAspectRatio="none"
          className="block w-full overflow-visible"
          style={{ height }}
          role="img"
          aria-label={ariaLabel}
        >
          {path && (
            <>
              <path
                d={`${path} L${VIEW_WIDTH},${height} L0,${height} Z`}
                fill={color}
                opacity="0.16"
              />
              <path
                d={path}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
        </svg>

        <div aria-hidden className="absolute inset-x-0 top-1.5 bottom-0">
          {xy.map((c) => (
            <span
              key={c.point.date}
              className="absolute size-2 translate-x-[-50%] translate-y-[50%] rounded-full"
              style={{
                left: `${c.left.toFixed(1)}%`,
                bottom: `${c.bottom.toFixed(1)}%`,
                backgroundColor: dotColor,
                boxShadow: `0 0 0 2.5px ${dotRing}`,
              }}
            />
          ))}
        </div>
      </div>

      {labels && labels.length > 0 && (
        <div aria-hidden className="mt-2.5 flex justify-between">
          {labels.map((label, i) => (
            <span key={`${label}-${i}`} className="text-micro text-ink-onnight-faint">
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
