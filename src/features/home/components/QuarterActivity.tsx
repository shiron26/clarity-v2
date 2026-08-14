import { ObjectiveHeatmap } from '../../../components/objectives/ObjectiveHeatmap'
import type { Objective } from '../../../hooks/useObjectives'
import type { ObjectiveWeek } from '../../../hooks/useObjectiveWeeks'
import type { IsoDate } from '../../../lib/appDate'
import { useDashboardPrefs } from '../useDashboardPrefs'

type QuarterActivityProps = {
  objectives: Objective[]
  /** Lundis des semaines couvrant le trimestre. */
  weeks: IsoDate[]
  /** `objectifId|semaineISO` → relevé hebdomadaire. */
  weekIndex: Map<string, ObjectiveWeek>
  /** `objectifId|jour` → ce jour a été crédité. */
  activeDays: Set<string>
  today: IsoDate
  quarter: number
}

export function QuarterActivity({
  objectives,
  weeks,
  weekIndex,
  activeDays,
  today,
  quarter,
}: QuarterActivityProps) {
  const { prefs } = useDashboardPrefs()

  return (
    <section className="rounded-2xl bg-night px-5.5 py-5">
      <h2 className="mb-3.5 text-[11px] font-semibold tracking-[1.5px] text-ink-onnight">
        ACTIVITÉ TRIMESTRIELLE · Q{quarter}
      </h2>

      <div className="grid gap-6.5 sm:grid-cols-2 lg:grid-cols-3">
        {objectives.map((objective) => (
          <ObjectiveHeatmap
            key={objective.id}
            objective={objective}
            weeks={weeks}
            weekIndex={weekIndex}
            activeDays={activeDays}
            today={today}
            privacy={prefs.privacy}
          />
        ))}
      </div>
    </section>
  )
}
