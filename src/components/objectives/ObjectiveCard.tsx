import { useMemo, type CSSProperties } from 'react'
import { cn } from '../../lib/cn'
import { CheckIcon } from '../icons/CheckIcon'
import type { Milestone } from '../../hooks/useMilestones'
import type { Objective } from '../../hooks/useObjectives'
import type { ObjectiveWeek } from '../../hooks/useObjectiveWeeks'
import { maskTitle, objectiveSkin } from '../../lib/objectivePalette'

export type ObjectiveCardProps = {
  objective: Objective
  /** Relevé de la semaine en cours — source de vérité de la progression. */
  week: ObjectiveWeek | undefined
  /** Jours crédités du trimestre, indexés `objectifId|jour`. */
  activeDays: Set<string>
  milestones: Milestone[]
  /** Les 7 dates de la semaine courante, du lundi au dimanche. */
  daysOfWeek: string[]
  today: string
  compact?: boolean
  /** Préférences d'affichage passées par l'écran hôte : le composant est partagé,
   *  il ne peut pas dépendre du contexte du dashboard. */
  privacy?: boolean
  showMilestones?: boolean
  /**
   * La carte est en couleur quand l'objectif a avancé aujourd'hui ; sinon elle
   * est désaturée. C'est l'écran hôte qui tranche — voir DashboardView.
   */
  lit?: boolean
  /** Joue la séquence « la carte se rallume » (tressaillement + retour couleur). */
  popping?: boolean
  className?: string
}

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

const DESATURATED = 'grayscale(1) brightness(.94) saturate(0) contrast(.94) opacity(.72)'

export function ObjectiveCard({
  objective,
  week,
  activeDays,
  milestones,
  daysOfWeek,
  today,
  compact = false,
  privacy = false,
  showMilestones = false,
  lit = true,
  popping = false,
  className,
}: ObjectiveCardProps) {
  const skin = objectiveSkin(objective.slot)
  const title = privacy ? maskTitle(objective.title) : objective.title

  // « Atteint » est déclaré par l'utilisateur (closed_at), jamais déduit d'un
  // calcul de progression (SPEC §3).
  const reached = objective.closed_at !== null
  // Cadence 7 = « quotidien » : on montre les 7 jours plutôt qu'une bague.
  const isDaily = objective.cadence === 7
  const target = week?.cadence_target ?? objective.cadence ?? 1
  const done = week?.active_days ?? 0

  return (
    <div
      className={cn(
        'relative flex flex-col overflow-hidden rounded-2xl p-[18px] text-white',
        compact && 'flex-row items-center gap-3 rounded-xl px-4 py-3.5',
        popping && 'animate-card-lit',
        className,
      )}
      style={{
        backgroundImage: skin.gradient,
        boxShadow: skin.shadow,
        // Le filtre n'est pas posé pendant le pop : `colorReveal` l'anime.
        filter: popping || lit ? undefined : DESATURATED,
        transition: 'filter .8s cubic-bezier(.22,1,.36,1)',
      }}
    >
      {popping && <CardBurst />}

      <div className={cn('min-w-0', compact && 'flex-1')}>
        {/* Les deux usages de `compact` ne se croisent jamais : le dashboard les
            empile en pleine largeur sous `lg`, l'écran Tâches les serre à trois
            par ligne au-dessus. D'où une taille responsive plutôt qu'une prop —
            14 px au large et le titre qui passe à la ligne, 12.5 px et coupé dans
            la bande étroite (maquette). */}
        <h3
          className={cn(
            'leading-tight font-semibold',
            compact ? 'text-[14px] lg:truncate lg:text-[12.5px]' : 'text-[15.5px]',
          )}
        >
          {title}
        </h3>
      </div>

      <div
        className={cn(
          'flex shrink-0 items-center justify-center',
          compact ? 'gap-1.5' : 'mt-2.5 h-[82px] gap-3.5',
        )}
      >
        {reached ? (
          <div className={cn('flex items-center gap-1.5', !compact && 'flex-col gap-1')}>
            <span
              className={cn(
                'flex items-center justify-center rounded-full bg-white/22',
                compact ? 'size-6.5' : 'size-11',
              )}
            >
              <CheckIcon className={compact ? 'size-3' : 'size-5'} />
            </span>
            <span className={cn('font-semibold tracking-[0.5px]', compact ? 'text-[9px]' : 'text-[10px]')}>
              ATTEINT
            </span>
          </div>
        ) : isDaily ? (
          <div className={cn('flex', compact ? 'gap-[3px]' : 'gap-[5px]')}>
            {daysOfWeek.map((day, i) => (
              <DayToken
                key={day}
                label={DAY_LABELS[i]!}
                state={dayState(activeDays.has(`${objective.id}|${day}`), day, today)}
                core={skin.core}
                size={compact ? 22 : 30}
              />
            ))}
          </div>
        ) : (
          <CadenceRing done={done} target={target} core={skin.core} size={compact ? 52 : 80} />
        )}
      </div>

      {!compact && showMilestones && milestones.length > 0 && (
        <div className="mt-3.5 flex flex-col gap-1.5 border-t border-white/20 pt-3">
          {milestones.map((m) => {
            const checked = m.completed_at !== null
            return (
              <div key={m.id} className="flex items-center gap-2">
                <span
                  className={cn(
                    'flex size-[15px] shrink-0 items-center justify-center rounded-[5px] border text-[9px]',
                    checked ? 'border-white bg-white/25' : 'border-white/45',
                  )}
                >
                  {checked && <CheckIcon className="size-2" />}
                </span>
                <span
                  className={cn(
                    'truncate text-[11.5px]',
                    checked ? 'text-white/60 line-through' : 'text-white/90',
                  )}
                >
                  {privacy ? maskTitle(m.title) : m.title}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

type DayState = 'done' | 'today' | 'miss' | 'future'

function dayState(active: boolean, day: string, today: string): DayState {
  if (active) return 'done'
  if (day === today) return 'today'
  return day < today ? 'miss' : 'future'
}

/**
 * Une pastille par jour de la semaine, pour les objectifs quotidiens. Les quatre
 * états se distinguent au trait : plein = fait, bordure pleine = aujourd'hui,
 * pointillés = manqué, trait fin = à venir.
 */
function DayToken({
  label,
  state,
  core,
  size,
}: {
  label: string
  state: DayState
  core: string
  size: number
}) {
  const done = state === 'done'

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold',
        state === 'done' && 'bg-white',
        state === 'today' && 'animate-cell-pulse border-[1.5px] border-white text-white',
        state === 'miss' && 'border-[1.5px] border-dashed border-white/55 text-white/70',
        state === 'future' && 'border border-white/40 text-white/60',
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        color: done ? core : undefined,
      }}
    >
      {done ? <CheckIcon style={{ width: size * 0.4, height: size * 0.4 }} /> : label}
    </span>
  )
}

/**
 * Bague de cadence : un segment par séance attendue dans la semaine, séparés par
 * un espace. On compte des jours actifs, on ne remplit pas une jauge — d'où des
 * traits discrets plutôt qu'un arc continu (SPEC §1 : pas de pourcentage).
 */
export function CadenceRing({
  done,
  target,
  core,
  size,
}: {
  done: number
  target: number
  core: string
  size: number
}) {
  const segments = Math.max(1, target)
  const inner = Math.round(size * 0.65)
  const large = size > 60

  const background = useMemo(() => {
    const step = 360 / segments
    const gap = 6
    const stops = Array.from({ length: segments }, (_, i) => {
      const color = i < done ? '#fff' : 'rgba(255,255,255,.3)'
      const start = i * step
      const end = (i + 1) * step
      return `${color} ${start}deg ${end - gap}deg,transparent ${end - gap}deg ${end}deg`
    })
    return `conic-gradient(from -90deg,${stops.join(',')})`
  }, [done, segments])

  return (
    <div
      role="img"
      aria-label={`${done} jour${done > 1 ? 's' : ''} actif${done > 1 ? 's' : ''} sur ${target} cette semaine`}
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, background } as CSSProperties}
    >
      <div
        className="flex items-center justify-center rounded-full"
        style={{ backgroundColor: core, width: inner, height: inner }}
      >
        <span className="font-semibold" style={{ fontSize: large ? 16 : 12 }}>
          {done}
          <span className="text-white/65" style={{ fontSize: large ? 11 : 9 }}>
            /{target}
          </span>
        </span>
      </div>
    </div>
  )
}

const BURST_COLORS = ['#fff', '#ffd43b', '#fff', '#ffe27a']
const BURST_COUNT = 14

// Trajectoires déterministes : la gerbe est identique d'une carte à l'autre,
// seule sa couleur de fond change. Calculée une fois pour tout le module.
const BURST_PARTICLES = Array.from({ length: BURST_COUNT }, (_, i) => {
  const angle = (i / BURST_COUNT) * Math.PI * 2 + 0.4
  const distance = 46 + (i % 3) * 26
  return {
    size: i % 3 === 0 ? 7 : 5,
    round: i % 2 === 1,
    color: BURST_COLORS[i % BURST_COLORS.length]!,
    tx: `${Math.cos(angle) * distance}px`,
    ty: `${Math.sin(angle) * distance}px`,
    delay: `${(i % 3) * 0.04}s`,
  }
})

/** Gerbe jouée au moment où la carte se rallume. Purement décoratif. */
function CardBurst() {
  const particles = BURST_PARTICLES

  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Le balayage passe avant le halo : la lumière traverse, puis la carte glow. */}
      <span
        className="animate-card-shine absolute inset-y-0 left-0 w-[55%]"
        style={{
          background: 'linear-gradient(105deg,transparent,rgba(255,255,255,.45) 50%,transparent)',
        }}
      />
      <span
        className="animate-card-glow absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 50% 50%,rgba(255,255,255,.35),transparent 65%)',
        }}
      />
      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute top-1/2 left-1/2"
          style={
            {
              width: p.size,
              height: p.size,
              borderRadius: p.round ? '50%' : 2,
              background: p.color,
              '--tx': p.tx,
              '--ty': p.ty,
              animation: 'fxBurst .85s cubic-bezier(.1,.7,.3,1) forwards',
              animationDelay: p.delay,
            } as CSSProperties
          }
        />
      ))}
    </span>
  )
}
