import { isoWeek, quarterOf, year as yearOf, yearProgressPercent } from '../../../lib/appDate'
import { cn } from '../../../lib/cn'
import type { WidgetSpan } from '../dashboardLayout'
import { useDashboardCtx } from '../dashboardContext'

const QUARTERS = [1, 2, 3, 4]

/**
 * « L'année » — où on en est dedans, et rien d'autre.
 *
 * Le pourcentage mesure le TEMPS ÉCOULÉ, pas une progression d'objectif : le
 * produit n'affiche jamais de score (SPEC §1). Il est calculé depuis la date du
 * serveur, jamais depuis l'horloge du navigateur.
 *
 * Il remplace la frise des douze mois et sa phrase d'échéance : douze initiales
 * et un trait ne disaient pas où on en était, et la date de fin des objectifs se
 * lit déjà sur leurs cartes. Ce qui restait à dire tenait en un pourcentage.
 *
 * Le bloc est SOMBRE, seul de l'accueil : c'est un repère, pas une carte de
 * travail, et rien ne s'y coche. Il porte donc son propre fond au lieu de passer
 * par `WidgetCard`. Il n'a aucune query : rien ne peut échouer, il n'a pas
 * d'état d'erreur.
 *
 * Les repères de trimestre ne sont pas cliquables : sur l'accueil il n'y a
 * aucun trimestre à sélectionner. C'est `/annee` qui sert à ça.
 */
export function HorizonWidget({ span }: { span: WidgetSpan }) {
  const { today } = useDashboardCtx()

  const percent = yearProgressPercent(today)
  const week = isoWeek(today).isoWeek
  const currentQuarter = quarterOf(today)
  // Le repli suit la largeur RÉELLE : posé sur un tiers de grand écran, le bloc
  // est aussi à l'étroit que sur un téléphone, et un point de rupture l'ignore.
  const narrow = span === 1

  return (
    <section className="flex h-full flex-col justify-center rounded-2xl bg-night px-4.5 py-4 sm:px-6 sm:py-5">
      <div className="mb-3.5 flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-body font-semibold tracking-[1.3px] text-ink-onnight-strong">
          {yearOf(today)} · SEMAINE {week}
        </span>
        <span className="shrink-0 font-semibold text-white">
          {percent}
          <span className="text-[11px] font-medium text-ink-onnight">
            {narrow ? ' %' : ' % de l’année'}
          </span>
        </span>
      </div>

      <div className="relative h-[7px] rounded-xs bg-night-line">
        <div
          className="bg-year-progress absolute inset-y-0 left-0 rounded-xs"
          style={{ width: `${percent}%` }}
        />
        <span
          aria-hidden
          className="absolute -top-[3.5px] size-3.5 -translate-x-[7px] rounded-full border-[3.5px] border-brand-bright bg-white"
          style={{ left: `${percent}%` }}
        />
      </div>

      <div aria-hidden className="mt-3 flex justify-between">
        {QUARTERS.map((q) => (
          <span
            key={q}
            className={cn(
              'rounded-2xl px-2.5 py-[3px] text-[10px]',
              q === currentQuarter
                ? 'bg-white/14 font-semibold text-white'
                : 'text-ink-onnight-faint',
            )}
          >
            Q{q}
            {q === currentQuarter && !narrow && ' · en cours'}
          </span>
        ))}
      </div>
    </section>
  )
}
