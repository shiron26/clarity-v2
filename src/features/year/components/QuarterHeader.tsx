import { Link } from 'react-router'
import { QuarterIcon } from '../../../components/icons/QuarterIcon'
import { buttonClasses } from '../../../components/ui/buttonClasses'
import { STEP_NEXT, STEP_PREV, stepperArrowClasses } from '../../../components/ui/stepperClasses'
import {
  bilanPath,
  quarterFullLabel,
  quarterPath,
  quarterRangeLabel,
} from '../../../lib/quarterLabels'
import { reviewStatus } from '../../../lib/reviewPeriod'

type QuarterHeaderProps = {
  year: number
  quarter: number
  /** T4 est aussi le bilan de l'année : le libellé le dit. */
  isYearEnd: boolean
  openAt: string | undefined
  isOpen: boolean
  validatedAt: string | null
  /**
   * Le trimestre a-t-il porté un objectif ? Les ouvertures sont globales, donc un
   * trimestre antérieur à l'arrivée du compte est « ouvert » sans avoir de sujet :
   * sans cette borne, son bouton menait à une cérémonie vide.
   */
  hasSubjects: boolean
}

/**
 * L'en-tête du trimestre — de quoi on parle, où l'on peut glisser, et ce qu'on
 * peut en faire.
 *
 * Le bilan vit ici et non dans une bande à lui : c'est **l'action du trimestre**,
 * elle appartient à son en-tête. Les deux flèches évitent de remonter à l'année
 * pour comparer deux trimestres voisins.
 */
export function QuarterHeader({
  year,
  quarter,
  isYearEnd,
  openAt,
  isOpen,
  validatedAt,
  hasSubjects,
}: QuarterHeaderProps) {
  const status = reviewStatus({ openAt, isOpen, validatedAt, hasSubjects })
  const label = isYearEnd
    ? `Bilan du trimestre ${quarter} et de l’année`
    : `Bilan du trimestre ${quarter}`

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4.5 py-4 lg:px-5.5 lg:py-4.5">
      {/* Un stepper, comme celui des années : une flèche de chaque côté de ce
          qu'elles font défiler. Les deux chevrons collés à droite du titre se
          lisaient comme un contrôle de plus, pas comme « le trimestre d'avant,
          celui d'après ». Le quart de cercle est DANS le pas : il change avec le
          libellé, les deux disent la même chose. */}
      <div className="flex w-full items-center gap-2 lg:w-auto lg:flex-1">
        <QuarterArrow
          year={year}
          quarter={quarter - 1}
          label="Trimestre précédent"
          glyph={STEP_PREV}
        />

        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-field text-ink-3">
          <QuarterIcon quarter={quarter} className="size-4" />
        </span>

        <h1 className="min-w-0 text-card font-semibold">
          {quarterFullLabel(quarter)}{' '}
          <span className="text-ink-muted">· {quarterRangeLabel(quarter)}</span>
        </h1>

        <QuarterArrow
          year={year}
          quarter={quarter + 1}
          label="Trimestre suivant"
          glyph={STEP_NEXT}
        />
      </div>

      <div className="flex w-full items-center justify-between gap-3.5 lg:w-auto lg:justify-end">
        <span className="text-label text-ink-muted">
          <span className="hidden sm:inline">{label} · </span>
          {status.meta}
        </span>

        {status.actionable ? (
          // La cérémonie porte sa période dans son adresse : c'est ce qui permet
          // au bouton de T2 d'ouvrir T2 depuis n'importe quelle page, là où
          // `/review` ouvre toujours la semaine courante.
          <Link to={bilanPath(year, { type: 'quarter', quarter })} className={buttonClasses()}>
            {status.cta}
          </Link>
        ) : (
          // La règle d'ouverture est énoncée juste à côté : le bouton n'aurait rien
          // à apprendre de plus au clic.
          <span className="rounded-md bg-field px-4 py-2.5 text-body font-medium text-ink-muted">
            {status.cta}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Une flèche de trimestre, éteinte aux deux bouts de l'année.
 *
 * Un `<Link>` et non un `<button>` : changer de trimestre change d'adresse. C'est
 * exactement pourquoi l'apparence vit dans `stepperClasses` plutôt que dans
 * `YearStepper`, qui, lui, ne pilote qu'un état local.
 */
function QuarterArrow({
  year,
  quarter,
  label,
  glyph,
}: {
  year: number
  quarter: number
  label: string
  glyph: string
}) {
  if (quarter < 1 || quarter > 4) {
    return (
      <span aria-hidden className={stepperArrowClasses({ disabled: true, className: 'shrink-0' })}>
        {glyph}
      </span>
    )
  }

  return (
    <Link
      to={quarterPath(year, quarter)}
      aria-label={label}
      className={stepperArrowClasses({ className: 'shrink-0' })}
    >
      {glyph}
    </Link>
  )
}
