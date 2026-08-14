import { cn } from '../../../lib/cn'
import { maskTitle, objectiveSkin } from '../../../lib/objectivePalette'
import { MAX_PRINCIPALS, MAX_SECONDARIES, type Objective } from '../../../hooks/useObjectives'
import { cadenceLabel } from '../objectiveDisplay'

// Les secondaires n'ont pas d'identité colorée : la couleur suit le slot d'un
// principal (SPEC §3), les secondaires partagent un gris commun.
const SECONDARY_GRADIENT = 'linear-gradient(150deg,#3f414d,#5a5c6b)'

type ObjectivePickerProps = {
  principals: Objective[]
  secondaries: Objective[]
  selectedId: string | undefined
  onSelect: (id: string) => void
  onCreateSecondary: () => void
  privacy?: boolean
  readOnly?: boolean
}

/** Rail latéral (desktop) : principaux puis secondaires, chacun sur son slot. */
export function ObjectivePicker({
  principals,
  secondaries,
  selectedId,
  onSelect,
  onCreateSecondary,
  privacy = false,
  readOnly = false,
}: ObjectivePickerProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <SectionLabel>
        PRINCIPAUX · {principals.length}/{MAX_PRINCIPALS}
      </SectionLabel>
      {principals.map((objective) => (
        <PickerItem
          key={objective.id}
          objective={objective}
          selected={objective.id === selectedId}
          onSelect={onSelect}
          privacy={privacy}
        />
      ))}

      <SectionLabel className="pt-3">
        SECONDAIRES · {secondaries.length}/{MAX_SECONDARIES}
      </SectionLabel>
      {secondaries.map((objective) => (
        <PickerItem
          key={objective.id}
          objective={objective}
          selected={objective.id === selectedId}
          onSelect={onSelect}
          privacy={privacy}
        />
      ))}

      {!readOnly && secondaries.length < MAX_SECONDARIES && (
        <button
          type="button"
          onClick={onCreateSecondary}
          className="cursor-pointer rounded-xl border-[1.5px] border-dashed border-border-strong p-3 text-center text-[11px] font-medium text-ink-muted transition-colors duration-150 hover:border-primary hover:text-primary focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none"
        >
          + Objectif secondaire
        </button>
      )}
    </div>
  )
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'px-1 py-0.5 text-[10px] font-semibold tracking-[1.3px] text-ink-muted',
        className,
      )}
    >
      {children}
    </div>
  )
}

function PickerItem({
  objective,
  selected,
  onSelect,
  privacy,
}: {
  objective: Objective
  selected: boolean
  onSelect: (id: string) => void
  privacy: boolean
}) {
  const isPrincipal = objective.kind === 'principal'
  const skin = objectiveSkin(objective.slot)
  const title = privacy ? maskTitle(objective.title) : objective.title
  const sub = isPrincipal ? cadenceLabel(objective.cadence) : (objective.description ?? '')

  return (
    <button
      type="button"
      onClick={() => onSelect(objective.id)}
      aria-pressed={selected}
      className={cn(
        'w-full cursor-pointer rounded-xl text-left transition-all duration-150',
        'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
        isPrincipal ? 'px-4.5 py-4' : 'px-4.5 py-3.5',
        !selected && 'border border-border bg-surface hover:border-border-strong',
      )}
      style={
        selected
          ? {
              backgroundImage: isPrincipal ? skin.gradient : SECONDARY_GRADIENT,
              boxShadow: isPrincipal ? skin.shadow : undefined,
            }
          : undefined
      }
    >
      <div
        className={cn(
          'leading-tight font-semibold',
          isPrincipal ? 'text-body' : 'text-[12px]',
          selected ? 'text-white' : 'text-ink',
        )}
      >
        {title}
      </div>
      {sub && (
        <div className={cn('mt-[3px] text-[10px]', selected ? 'text-white/75' : 'text-ink-muted')}>
          {privacy && !isPrincipal ? '•••' : sub}
        </div>
      )}
    </button>
  )
}

