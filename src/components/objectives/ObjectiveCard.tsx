import { useMemo, type CSSProperties, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { CheckIcon } from '../icons/CheckIcon'
import { TargetIcon } from '../icons/TargetIcon'
import type { Milestone } from '../../hooks/useMilestones'
import type { Objective } from '../../hooks/useObjectives'
import type { ObjectivePeriod } from '../../hooks/useObjectivePeriods'
import type { ObjectiveProgress } from '../../hooks/useObjectiveProgress'
import { maskTitle, objectiveSkin } from '../../lib/objectivePalette'
import { formatQuantity, periodLabel } from '../../lib/objectiveWording'

/**
 * La carte d'un objectif principal.
 *
 * **Chaque mesure a son langage** (REFONTE §3) : une habitude montre son rythme,
 * une quantité son montant, des jalons leurs étapes. Forcer les trois dans une
 * grille de cadence ferait lire un objectif quantifié comme une semaine ratée —
 * exactement le reproche que la refonte enlève.
 *
 * **Un titre, un indicateur, rien d'autre.** La carte portait aussi le
 * sous-titre de mesure (« Habitude · 3×/semaine »), le badge de fenêtre et deux
 * lignes de commentaire à côté de l'anneau (« séances cette semaine »,
 * « régularité 100 % ») : quatre textes autour d'un objet qui se lit seul, et
 * l'indicateur poussé dans un coin. Tout cela se retrouve sur l'écran Objectifs,
 * où c'est le sujet. Ici l'indicateur est centré et il est le seul contenu.
 *
 * Une exception, en haut à droite : la **période** (« Semaine », « Mois »). Elle
 * n'est pas un commentaire de l'indicateur, elle en donne l'échelle — « 1/3 » ne
 * dit pas dans quoi ces trois fois sont attendues, et la cadence peut être
 * mensuelle. Deux mots, jamais rendus sur la variante compacte, où la valeur
 * occupe déjà la droite du titre.
 */
export type ObjectiveCardProps = {
  objective: Objective
  /** Relevé de la période en cours — source de vérité de la progression. */
  week: ObjectivePeriod | undefined
  /** Jours crédités du trimestre, indexés `objectifId|jour`. */
  activeDays: Set<string>
  milestones: Milestone[]
  /** Les 7 dates de la semaine courante, du lundi au dimanche. */
  daysOfWeek: string[]
  today: string
  /** Progression d'un objectif quantifié. */
  progress?: ObjectiveProgress
  compact?: boolean
  /** Préférences d'affichage passées par l'écran hôte : le composant est partagé,
   *  il ne peut pas dépendre du contexte du dashboard. */
  privacy?: boolean
  /**
   * La carte est en couleur quand l'objectif a avancé aujourd'hui ; sinon elle
   * est désaturée. C'est l'écran hôte qui tranche — voir `isObjectiveLit`.
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
  progress,
  compact = false,
  privacy = false,
  lit = true,
  popping = false,
  className,
}: ObjectiveCardProps) {
  const skin = objectiveSkin(objective.slot)
  const title = privacy ? maskTitle(objective.title) : objective.title

  // Pleine largeur seulement : une carte compacte porte déjà sa valeur à droite
  // du titre, la pastille lui disputerait la place.
  const period = compact ? null : periodLabel(objective.period_unit)

  // « Atteint » est déclaré par l'utilisateur (closed_at), jamais déduit d'un
  // calcul de progression (SPEC §3).
  const reached = objective.closed_at !== null

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

      {/* La cible : le titre d'un objectif ressemble à n'importe quel titre,
          l'icône dit de quoi la carte parle avant qu'on l'ait lu. En aplat et non
          au trait — voir `TargetIcon`. Décorative, donc `aria-hidden` (l'icône le
          porte déjà) et jamais annoncée deux fois. */}
      <div className={cn('flex min-w-0 items-center gap-2', compact && 'flex-1')}>
        <span
          className={cn(
            'flex shrink-0 items-center justify-center rounded-lg bg-white/20',
            compact ? 'size-5.5' : 'size-6.5',
          )}
        >
          <TargetIcon className={compact ? 'size-3.5' : 'size-4'} />
        </span>
        {/* Les deux usages de `compact` ne se croisent jamais : le dashboard les
            empile en pleine largeur sous `lg`, l'écran Tâches les serre à trois
            par ligne au-dessus. D'où une taille responsive plutôt qu'une prop. */}
        <h3
          className={cn(
            'min-w-0 leading-tight font-semibold',
            compact ? 'text-[14px] lg:truncate lg:text-[12.5px]' : 'text-[15.5px]',
          )}
        >
          {title}
        </h3>
        {period && (
          <span className="mt-px ml-auto shrink-0 self-start rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold">
            {period}
          </span>
        )}
      </div>

      {reached ? (
        <ReachedMark compact={compact} />
      ) : compact ? (
        <CompactValue
          objective={objective}
          week={week}
          milestones={milestones}
          progress={progress}
          core={skin.core}
        />
      ) : (
        <div className="mt-3.5 flex min-h-[86px] flex-1 flex-col items-center justify-center">
          <FullVisual
            objective={objective}
            week={week}
            activeDays={activeDays}
            milestones={milestones}
            daysOfWeek={daysOfWeek}
            today={today}
            progress={progress}
            privacy={privacy}
            core={skin.core}
          />
        </div>
      )}
    </div>
  )
}

/** L'objectif est déclaré atteint : plus rien à mesurer, on le dit et c'est tout. */
function ReachedMark({ compact }: { compact: boolean }) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-1.5',
        compact
          ? 'ml-auto'
          : 'mt-3.5 min-h-[86px] flex-1 flex-col items-center justify-center gap-1',
      )}
    >
      <span
        className={cn(
          'flex items-center justify-center rounded-full bg-white/22',
          compact ? 'size-6.5' : 'size-11',
        )}
      >
        <CheckIcon className={compact ? 'size-3' : 'size-5'} />
      </span>
      <span
        className={cn('font-semibold tracking-[0.5px]', compact ? 'text-[9px]' : 'text-[10px]')}
      >
        ATTEINT
      </span>
    </div>
  )
}

type VisualProps = {
  objective: Objective
  week: ObjectivePeriod | undefined
  activeDays: Set<string>
  milestones: Milestone[]
  daysOfWeek: string[]
  today: string
  progress?: ObjectiveProgress
  privacy: boolean
  core: string
}

function FullVisual(props: VisualProps) {
  const { objective, week, milestones, progress, privacy, core } = props

  if (objective.measure === 'quantite') {
    const value = progress?.value ?? 0
    const target = objective.target_value
    const pct = target && target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0
    return (
      <div className="flex w-full flex-col items-center gap-2.5">
        {/* Une unité est un suffixe court (« € », « km »), mais elle peut être
            écrite à la main (« chapitres ») et elle est rendue deux fois : sans
            retour à la ligne, « 0 chapitres sur 20 chapitres » sortait de la
            carte, qui est en `overflow-hidden` et le coupait net. La ligne se
            replie donc, centrée, et `break-words` couvre le mot seul plus large
            que la carte sur un écran étroit. */}
        <span className="max-w-full text-center text-[21px] leading-tight font-semibold break-words">
          {formatQuantity(value, objective.unit)}
          <span className="ml-1 text-[11px] font-normal text-white/72">
            sur {formatQuantity(target, objective.unit)}
          </span>
        </span>
        <QuantityBar percent={pct} />
      </div>
    )
  }

  if (objective.measure === 'jalons') {
    if (milestones.length === 0) {
      return <p className="text-[11px] text-white/72">Aucune étape sur ce trimestre.</p>
    }
    return (
      <div className="flex w-full flex-col gap-[7px]">
        {milestones.map((m) => (
          <MilestoneLine key={m.id} milestone={m} privacy={privacy} />
        ))}
      </div>
    )
  }

  return <HabitVisual {...props} core={core} week={week} />
}

/**
 * L'habitude : le rythme, et rien de plus.
 *
 * En cadence quotidienne les sept pastilles disent QUEL jour manque — une
 * information que l'anneau ne porte pas. Sinon c'est l'anneau, seul et centré :
 * « 2/3 » dans une carte qui annonce déjà trois séances par semaine n'a besoin
 * d'aucune légende.
 */
function HabitVisual({ objective, week, activeDays, daysOfWeek, today, core }: VisualProps) {
  const target = week?.target ?? objective.cadence ?? 1
  const done = week?.done ?? 0
  const isDaily = target === 7 && objective.period_unit !== 'month'

  if (isDaily) {
    return (
      <div className="flex justify-center gap-[5px]">
        {daysOfWeek.map((day, i) => (
          <DayToken
            key={day}
            label={DAY_LABELS[i]!}
            state={dayState(activeDays.has(`${objective.id}|${day}`), day, today)}
            core={core}
            size={30}
          />
        ))}
      </div>
    )
  }

  return <CadenceRing done={done} target={target} core={core} size={82} />
}

/**
 * La valeur d'une carte compacte, à droite du titre : un seul objet, jamais un
 * bloc empilé. Même en cadence quotidienne c'est l'anneau — sept pastilles ne
 * tiennent pas sur une ligne de 68 px.
 */
function CompactValue({
  objective,
  week,
  milestones,
  progress,
  core,
}: {
  objective: Objective
  week: ObjectivePeriod | undefined
  milestones: Milestone[]
  progress?: ObjectiveProgress
  core: string
}) {
  if (objective.measure === 'quantite') {
    // Une ligne, deux textes : le titre à gauche tronque déjà, la valeur doit
    // en faire autant. Sans plafond, une unité écrite à la main (« chapitres »)
    // pousserait le titre à quelques caractères.
    return (
      <div className="max-w-[52%] shrink-0 text-right">
        <div className="truncate text-[16px] font-semibold">
          {formatQuantity(progress?.value ?? 0, objective.unit)}
        </div>
        <div className="mt-px truncate text-[10px] text-white/70">
          sur {formatQuantity(objective.target_value, objective.unit)}
        </div>
      </div>
    )
  }

  if (objective.measure === 'jalons') {
    const done = milestones.filter((m) => m.completed_at !== null).length
    return (
      <div className="shrink-0 text-right">
        <div className="text-[16px] font-semibold">
          {done} / {milestones.length}
        </div>
        <div className="mt-px text-[10px] text-white/70">étapes</div>
      </div>
    )
  }

  return (
    <CadenceRing
      done={week?.done ?? 0}
      target={week?.target ?? objective.cadence ?? 1}
      core={core}
      size={52}
    />
  )
}

function MilestoneLine({ milestone, privacy }: { milestone: Milestone; privacy: boolean }) {
  const checked = milestone.completed_at !== null
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          'flex size-[15px] shrink-0 items-center justify-center rounded-[5px] border',
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
        {privacy ? maskTitle(milestone.title) : milestone.title}
      </span>
    </div>
  )
}

/** Barre de progression d'une quantité — la seule jauge continue du produit. */
function QuantityBar({ percent }: { percent: number }): ReactNode {
  return (
    <div className="h-[9px] w-full overflow-hidden rounded-xs bg-white/22">
      <div className="h-full rounded-xs bg-white" style={{ width: `${percent}%` }} />
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
 * Bague de cadence : un segment par séance attendue dans la période, séparés par
 * un espace. On compte des jours actifs, on ne remplit pas une jauge — d'où des
 * traits discrets plutôt qu'un arc continu (SPEC §1 : pas de pourcentage).
 */
function CadenceRing({
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
      aria-label={`${done} jour${done > 1 ? 's' : ''} actif${done > 1 ? 's' : ''} sur ${target} cette période`}
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
          background:
            'linear-gradient(105deg,transparent,rgba(255,255,255,.45) 50%,transparent)',
        }}
      />
      <span
        className="animate-card-glow absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 50%,rgba(255,255,255,.35),transparent 65%)',
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
