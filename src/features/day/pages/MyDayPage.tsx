import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { CakeIcon } from '../../../components/icons/CakeIcon'
import { CalendarIcon } from '../../../components/icons/CalendarIcon'
import { GearIcon } from '../../../components/icons/GearIcon'
import { MailFlagIcon } from '../../../components/icons/MailFlagIcon'
import { MailIcon } from '../../../components/icons/MailIcon'
import { SunIcon } from '../../../components/icons/SunIcon'
import { TasksIcon } from '../../../components/icons/TasksIcon'
import { TaskRowList } from '../../../components/tasks/TaskRowList'
import { Alert } from '../../../components/ui/Alert'
import { Avatar } from '../../../components/ui/Avatar'
import { buttonClasses } from '../../../components/ui/buttonClasses'
import { EmptyState } from '../../../components/ui/EmptyState'
import { Menu } from '../../../components/ui/Menu'
import { ErrorState } from '../../../components/ui/ErrorState'
import { SECTION_LABEL } from '../../../components/ui/sectionLabel'
import { Spinner } from '../../../components/ui/Spinner'
import { useAppDayStart, useAppToday } from '../../../hooks/useAppToday'
import { useTaskCompletion } from '../../../hooks/useTaskCompletion'
import { selectTaskLists, useLists } from '../../../hooks/useLists'
import { useObjectives } from '../../../hooks/useObjectives'
import { useQueriesState } from '../../../hooks/useQueriesState'
import { useTasks, type Task } from '../../../hooks/useTasks'
import { addDays, formatLongDate, formatShortDate, year, type IsoDate } from '../../../lib/appDate'
import { cn } from '../../../lib/cn'
import { dataErrorMessage } from '../../../lib/errorMessage'
import { daySections } from '../../../lib/taskDay'
import { smsLink, whatsappLink } from '../../../lib/messageLinks'
import { useMarkMyDayViewed, useDigestSettings } from '../../../hooks/useDigestSettings'
import { DayCard as Card } from '../components/DayCard'
import { useMyDay, type DayBirthday, type DayEmail, type DayEvent } from '../useDay'

/** Au-delà, une liste de mails se replie : le reste se déplie à la demande. */
const MAILS_SHOWN = 5

/**
 * « Ma journée » (SPEC-MA-JOURNEE §0) : là où mène la notification du matin.
 *
 * L'ordre est celui d'une matinée : les anniversaires d'abord (rares, et le seul
 * geste qui ne se rattrape pas le lendemain), puis l'agenda, les tâches, et les
 * mails en dernier. Une section sans contenu ne s'affiche pas : une carte vide
 * qui dit « rien ici » est du bruit à côté de celles qui ont quelque chose à dire.
 *
 * Les tâches sont celles de la vue « Aujourd'hui » de /taches (même requête, même
 * prédicat `src/lib/taskDay.ts`), avec les lignes partagées du dashboard
 * (`TaskRowList`) et leur animation de coche. Une différence, voulue : une tâche
 * cochée aujourd'hui RESTE à sa place, barrée. Cet écran est le bilan du jour,
 * pas une liste qui se vide.
 */
export function MyDayPage() {
  const todayQuery = useAppToday()
  const dayStartQuery = useAppDayStart()
  const today = todayQuery.data
  const tasksQuery = useTasks('all', { completedSince: dayStartQuery.data })
  const dayQuery = useMyDay(today)
  const listsQuery = useLists()
  const objectivesQuery = useObjectives(today ? year(today) : undefined)
  const { firstError, retrying, onRetry } = useQueriesState([
    todayQuery,
    dayStartQuery,
    tasksQuery,
    dayQuery,
  ])

  // Ouvrir l'écran éteint le bouton du dashboard. Une fois par jour suffit : la
  // RPC est idempotente, mais inutile de la rejouer à chaque rendu.
  const settingsQuery = useDigestSettings()
  const markViewed = useMarkMyDayViewed()
  const markedFor = useRef<string | null>(null)
  const viewedOn = settingsQuery.data?.last_viewed_on
  useEffect(() => {
    if (!today || !settingsQuery.data || viewedOn === today || markedFor.current === today) return
    markedFor.current = today
    markViewed.mutate(today)
  }, [today, settingsQuery.data, viewedOn, markViewed])

  if (todayQuery.isLoadingError) {
    return (
      <ErrorState description={dataErrorMessage(todayQuery.error)} onRetry={onRetry} retrying={retrying} />
    )
  }

  const day = dayQuery.data
  const loading = !today || !day || !tasksQuery.data

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-h1 font-semibold">Ma journée</h1>
          {today && <p className="text-body text-ink-2 first-letter:uppercase">{formatLongDate(today)}</p>}
        </div>
        <Link
          to="/ma-journee/reglages"
          aria-label="Réglages de Ma journée"
          className={buttonClasses({ variant: 'ghost', className: 'size-9 shrink-0 p-0 text-ink-muted' })}
        >
          <GearIcon className="size-[18px]" />
        </Link>
      </header>

      {firstError && (
        <ErrorState description={dataErrorMessage(firstError)} onRetry={onRetry} retrying={retrying} />
      )}

      {day?.sync.stale && (
        <Alert>
          La synchronisation avec Google est interrompue : agenda, mails et anniversaires peuvent
          dater d’hier. Vérifiez le script dans votre compte Google.
        </Alert>
      )}

      {loading ? (
        !firstError && (
          <div className="flex justify-center py-16">
            <Spinner className="size-5" label="Chargement de votre journée" />
          </div>
        )
      ) : (
        <DayContent
          today={today}
          day={day}
          tasks={tasksQuery.data}
          objectives={objectivesQuery.data}
          lists={listsQuery.data}
        />
      )}
    </div>
  )
}

function DayContent({
  today,
  day,
  tasks,
  objectives,
  lists,
}: {
  today: IsoDate
  day: NonNullable<ReturnType<typeof useMyDay>['data']>
  tasks: Task[]
  objectives: ReturnType<typeof useObjectives>['data']
  lists: ReturnType<typeof useLists>['data']
}) {
  // `exit: false` : la ligne cochée flashe puis reste, barrée (voir `daySections`).
  const { donePhaseFor, reducedMotion, onToggle, onToggleImportant } = useTaskCompletion({
    exit: false,
  })

  const objectiveById = useMemo(() => new Map((objectives ?? []).map((o) => [o.id, o])), [objectives])
  const listById = useMemo(() => new Map(selectTaskLists(lists).map((l) => [l.id, l])), [lists])
  const { overdue, dueToday, pending } = useMemo(() => daySections(tasks, today), [tasks, today])

  const importantMails = day.emails.filter((m) => m.important)
  const otherMails = day.emails.filter((m) => !m.important)

  const hasBirthdays = day.birthdays.today.length + day.birthdays.tomorrow.length > 0
  const hasEvents = day.events.today.length + day.events.tomorrow.length > 0
  const hasTasks = dueToday.length + overdue.length > 0
  const hasDay = hasBirthdays || hasEvents || hasTasks
  const hasMails = day.emails.length > 0

  if (!hasDay && !hasMails) {
    return (
      <EmptyState
        icon={<SunIcon className="size-6" />}
        title="Rien de prévu aujourd’hui"
        description="Ni rendez-vous, ni tâche, ni mail en attente. La journée est à vous."
      />
    )
  }

  // Deux blocs de lignes partagées ; le titre « Aujourd'hui » n'apparaît que sous
  // un bloc de retard, sans quoi il ne distinguerait rien.
  const taskBlocks = [
    { key: 'overdue', label: 'En retard', tasks: overdue, extra: { showDueDate: true } },
    { key: 'today', label: 'Aujourd’hui', tasks: dueToday, extra: { today } },
  ].filter((block) => block.tasks.length > 0)

  return (
    // Sur grand écran, deux colonnes : la journée à gauche, les mails à droite.
    // Pleine largeur, une ligne de mail traversait 1 500 px entre l'expéditeur et
    // l'heure. Sur téléphone, une seule colonne, dans l'ordre de la matinée. Une
    // colonne vide ne se pose pas : l'autre prend alors toute la place.
    <div className={cn('grid items-start gap-4', hasDay && hasMails && 'lg:grid-cols-2')}>
      {hasDay && (
        <div className="flex min-w-0 flex-col gap-4">
          {hasBirthdays && (
            <BirthdaysCard today={day.birthdays.today} tomorrow={day.birthdays.tomorrow} />
          )}
          {hasEvents && <EventsCard today={day.events.today} tomorrow={day.events.tomorrow} />}
          {hasTasks && (
            <Card
              title="Tâches"
              icon={<TasksIcon className="size-3.5" />}
              meta={pending > 0 ? `${pending} à faire` : 'Tout est fait'}
            >
              {taskBlocks.map((block, i) => (
                <div key={block.key} className={cn(i > 0 && 'mt-4')}>
                  {(block.key === 'overdue' || i > 0) && (
                    <h3
                      className={cn(SECTION_LABEL, 'mb-0.5', block.key === 'overdue' && 'text-danger')}
                    >
                      {block.label}
                    </h3>
                  )}
                  <TaskRowList
                    tasks={block.tasks}
                    objectives={objectiveById}
                    lists={listById}
                    onToggle={onToggle}
                    onToggleImportant={onToggleImportant}
                    donePhaseFor={donePhaseFor}
                    reducedMotion={reducedMotion}
                    {...block.extra}
                  />
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {hasMails && (
        <div className="flex min-w-0 flex-col gap-4">
          {importantMails.length > 0 && (
            <MailsCard
              title="Mails importants"
              icon={<MailFlagIcon />}
              mails={importantMails}
              today={today}
            />
          )}
          {otherMails.length > 0 && (
            <MailsCard
              title={importantMails.length > 0 ? 'Autres mails' : 'Mails'}
              icon={<MailIcon className="size-3.5" />}
              mails={otherMails}
              today={today}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ─── Briques ────────────────────────────────────────────────────────────────

function BirthdaysCard({
  today,
  tomorrow,
}: {
  today: DayBirthday[]
  tomorrow: Pick<DayBirthday, 'id' | 'name' | 'age'>[]
}) {
  return (
    <Card title={today.length > 0 ? 'Anniversaires' : 'Anniversaire demain'} icon={<CakeIcon />}>
      {today.length > 0 && (
        <ul className="flex flex-col gap-3">
          {today.map((b) => (
            <li key={b.id} className="flex items-center gap-3">
              <Avatar name={b.name} size="sm" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-ui font-medium">{b.name}</span>
                <span className="text-label text-ink-muted">
                  {b.age !== null ? `Fête ses ${b.age} ans aujourd’hui` : 'Fête son anniversaire aujourd’hui'}
                </span>
              </div>
              <WriteButton birthday={b} />
            </li>
          ))}
        </ul>
      )}
      {tomorrow.length > 0 && (
        <p className={cn('text-label text-ink-2', today.length > 0 && 'mt-4 border-t border-surface-subtle pt-3')}>
          <span className="text-ink-muted">Demain · </span>
          {tomorrow.map((b) => (b.age !== null ? `${b.name} (${b.age} ans)` : b.name)).join(', ')}
        </p>
      )}
    </Card>
  )
}

/**
 * « Lui écrire » : WhatsApp ou l'app de messagerie du téléphone, au choix. Le
 * message est déjà rédigé dans les deux cas, c'est l'utilisateur qui l'envoie.
 * Sans numéro exploitable, pas de bouton : rien ne pourrait s'ouvrir.
 */
function WriteButton({ birthday }: { birthday: DayBirthday }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const whatsapp = whatsappLink(birthday.phone, birthday.message)
  const sms = smsLink(birthday.phone, birthday.message)
  if (!whatsapp || !sms) return null

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={buttonClasses({ variant: 'secondary', size: 'sm' })}
      >
        Lui écrire
      </button>
      <Menu
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        label={`Écrire à ${birthday.first_name}`}
        variant="actions"
        offset={38}
        items={[
          {
            id: 'whatsapp',
            label: 'WhatsApp',
            onSelect: () => {
              setOpen(false)
              window.open(whatsapp, '_blank', 'noopener')
            },
          },
          {
            id: 'sms',
            label: 'Messages',
            onSelect: () => {
              setOpen(false)
              // Un schéma `sms:` s'ouvre dans l'app du téléphone, pas dans un onglet.
              window.location.href = sms
            },
          },
        ]}
      />
    </div>
  )
}

/** Le nom de l'agenda principal est l'adresse du compte : il n'apprend rien. */
function calendarLabel(event: DayEvent): string | null {
  return event.calendar.includes('@') ? null : event.calendar
}

function EventsCard({ today, tomorrow }: { today: DayEvent[]; tomorrow: DayEvent[] }) {
  return (
    <Card
      title="Rendez-vous"
      icon={<CalendarIcon />}
      meta={today.length > 0 ? `${today.length} aujourd’hui` : undefined}
    >
      {today.length > 0 && <EventList events={today} />}
      {tomorrow.length > 0 && (
        <>
          <h3 className={cn(SECTION_LABEL, today.length > 0 && 'mt-4', 'mb-2')}>Demain</h3>
          <EventList events={tomorrow} muted />
        </>
      )}
    </Card>
  )
}

function EventList({ events, muted = false }: { events: DayEvent[]; muted?: boolean }) {
  return (
    <ul className="flex flex-col">
      {events.map((e, i) => {
        const meta = [e.location, calendarLabel(e)].filter(Boolean).join(' · ')
        return (
          <li
            key={`${e.starts_at}-${e.title}`}
            className={cn('flex gap-4 py-2.5', i > 0 && 'border-t border-surface-subtle')}
          >
            <span
              className={cn(
                'w-[86px] shrink-0 pt-px text-label tabular-nums',
                muted ? 'text-ink-muted' : 'font-medium text-primary',
              )}
            >
              {e.all_day ? 'Toute la journée' : `${e.start_time} – ${e.end_time}`}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className={cn('text-ui', muted ? 'text-ink-2' : 'font-medium text-ink')}>{e.title}</span>
              {meta && <span className="truncate text-label text-ink-muted">{meta}</span>}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function receivedLabel(mail: DayEmail, today: IsoDate): string {
  if (mail.received_on === today) return mail.received_time
  if (mail.received_on === addDays(today, -1)) return 'Hier'
  return formatShortDate(mail.received_on)
}

function MailsCard({
  title,
  icon,
  mails,
  today,
}: {
  title: string
  icon: ReactNode
  mails: DayEmail[]
  today: IsoDate
}) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? mails : mails.slice(0, MAILS_SHOWN)

  return (
    <Card title={title} icon={icon} meta={`${mails.length} non lu${mails.length > 1 ? 's' : ''}`}>
      <ul className="flex flex-col">
        {shown.map((m, i) => (
          <li key={`${m.received_at}-${m.subject}`} className={cn(i > 0 && 'border-t border-surface-subtle')}>
            <MailRow mail={m} today={today} />
          </li>
        ))}
      </ul>
      {mails.length > MAILS_SHOWN && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 cursor-pointer text-label font-medium text-primary hover:text-primary-hover focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none"
        >
          {expanded ? 'Réduire' : `Afficher les ${mails.length - MAILS_SHOWN} autres`}
        </button>
      )}
    </Card>
  )
}

function MailRow({ mail, today }: { mail: DayEmail; today: IsoDate }) {
  const body = (
    <>
      <span className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-label font-medium text-ink-2">{mail.from_name}</span>
        <span className="shrink-0 text-caption text-ink-muted tabular-nums">{receivedLabel(mail, today)}</span>
      </span>
      <span className="line-clamp-2 text-ui text-ink">{mail.subject}</span>
    </>
  )
  const rowClass = 'flex flex-col gap-0.5 py-2.5'
  return mail.url ? (
    <a
      href={mail.url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        rowClass,
        '-mx-2 rounded-sm px-2 transition-colors duration-150 hover:bg-surface-subtle',
        'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
      )}
    >
      {body}
    </a>
  ) : (
    <div className={rowClass}>{body}</div>
  )
}
