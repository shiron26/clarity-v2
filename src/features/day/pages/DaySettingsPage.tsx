import { useEffect, useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { BellIcon } from '../../../components/icons/BellIcon'
import { CakeIcon } from '../../../components/icons/CakeIcon'
import { RepeatIcon } from '../../../components/icons/RepeatIcon'
import { SunIcon } from '../../../components/icons/SunIcon'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { buttonClasses } from '../../../components/ui/buttonClasses'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { SECTION_LABEL } from '../../../components/ui/sectionLabel'
import { Spinner } from '../../../components/ui/Spinner'
import { Switch } from '../../../components/ui/Switch'
import { Textarea } from '../../../components/ui/Textarea'
import { useDigestSettings } from '../../../hooks/useDigestSettings'
import { useQueriesState } from '../../../hooks/useQueriesState'
import { cn } from '../../../lib/cn'
import { dataErrorMessage } from '../../../lib/errorMessage'
import {
  disablePush,
  enablePush,
  hasPushSubscription,
  notificationPermission,
  pushSupport,
} from '../../../lib/push'
import { formatAgo } from '../../../lib/relativeTime'
import { DayCard } from '../components/DayCard'
import {
  useCreateIngestToken,
  useIngestTokens,
  usePushDevices,
  useRemovePushDevice,
  useRevokeIngestToken,
  useSendTestNotification,
  useUpdateDigestSettings,
} from '../useDay'

/**
 * Réglages de « Ma journée » (SPEC-MA-JOURNEE §8) : les notifications de cet
 * appareil, l'heure du résumé, le message d'anniversaire, et le lien avec Google.
 *
 * Quatre cartes, du plus fréquent au plus rare : on règle ses notifications à
 * chaque nouvel appareil, le jeton Google une fois pour toutes.
 */
export function DaySettingsPage() {
  const tokensQuery = useIngestTokens()
  const settingsQuery = useDigestSettings()
  const devicesQuery = usePushDevices()
  const { firstError, retrying, onRetry } = useQueriesState([tokensQuery, settingsQuery, devicesQuery])

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <Link
          to="/ma-journee"
          className="-ml-1 flex w-fit items-center gap-1 rounded-sm px-1 text-label font-medium text-primary hover:text-primary-hover focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none"
        >
          <span aria-hidden>‹</span> Ma journée
        </Link>
        <h1 className="text-h1 font-semibold">Réglages</h1>
      </header>

      {firstError && (
        <ErrorState description={dataErrorMessage(firstError)} onRetry={onRetry} retrying={retrying} />
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          <NotificationsCard />
          <MorningCard />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <BirthdayMessageCard />
          <GoogleCard />
        </div>
      </div>
    </div>
  )
}

// ─── Briques ────────────────────────────────────────────────────────────────

/** Le libellé d'une ligne de réglage, et sa précision en dessous. */
function RowText({ title, description }: { title: ReactNode; description?: ReactNode }) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="text-ui text-ink">{title}</span>
      {description && <span className="text-label text-ink-muted">{description}</span>}
    </span>
  )
}

/** Une ligne de réglage : ce que c'est à gauche, le contrôle à droite. */
function SettingRow({
  title,
  description,
  control,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  control?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between gap-4 py-3', className)}>
      <RowText title={title} description={description} />
      {control && <div className="shrink-0">{control}</div>}
    </div>
  )
}

/** Un interrupteur dont toute la ligne est la cible, comme sur mobile (44 px). */
function SwitchRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <Switch checked={checked} onChange={onChange} label={title} className="py-3">
      <RowText title={title} description={description} />
    </Switch>
  )
}

function Note({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-surface-subtle px-3.5 py-3 text-label text-ink-2">{children}</p>
}

/** Retirer un appareil, révoquer un jeton : le bouton discret qui rougit au survol. */
const ROW_ACTION = buttonClasses({ variant: 'danger', size: 'sm' })

/** Plafond serveur des jetons actifs (`ingest_token_cap`). */
const MAX_TOKENS = 3

// ─── Notifications ──────────────────────────────────────────────────────────

function NotificationsCard() {
  const support = pushSupport()
  const [subscribed, setSubscribed] = useState<boolean | null>(null)
  const [permission, setPermission] = useState(notificationPermission)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const devicesQuery = usePushDevices()
  const removeDevice = useRemovePushDevice()
  const sendTest = useSendTestNotification()
  const devices = devicesQuery.data ?? []

  useEffect(() => {
    if (support !== 'ok') return
    let cancelled = false
    void hasPushSubscription().then((value) => {
      if (!cancelled) setSubscribed(value)
    })
    return () => {
      cancelled = true
    }
  }, [support])

  const toggle = async () => {
    setBusy(true)
    setError(null)
    try {
      if (subscribed) {
        await disablePush()
        setSubscribed(false)
      } else {
        const result = await enablePush()
        setPermission(result)
        setSubscribed(result === 'granted')
      }
      void devicesQuery.refetch()
    } catch (e) {
      console.error('Notifications', e)
      setError(dataErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <DayCard title="Notifications" icon={<BellIcon />} meta={busy ? <Spinner className="size-3.5" label="Enregistrement" /> : undefined}>
      {support === 'needsInstall' && (
        <Note>
          Sur iPhone, les notifications passent par l’app installée. Dans Safari, touchez Partager
          puis « Sur l’écran d’accueil », et revenez ici depuis l’icône Clarity.
        </Note>
      )}
      {support === 'unsupported' && <Note>Ce navigateur ne reçoit pas de notifications.</Note>}
      {support === 'ok' && permission === 'denied' && (
        <Note>
          Les notifications sont bloquées pour Clarity. Autorisez-les dans les réglages de
          l’appareil, puis revenez ici.
        </Note>
      )}
      {support === 'ok' && permission !== 'denied' && subscribed !== null && (
        <SwitchRow
          title="Sur cet appareil"
          description="Recevoir le résumé du matin ici."
          checked={subscribed}
          onChange={() => void toggle()}
        />
      )}
      {error && <Alert className="mt-2">{error}</Alert>}

      {devices.length > 0 && (
        <>
          <h3 className={cn(SECTION_LABEL, 'mt-4 mb-1')}>Appareils abonnés</h3>
          <ul className="flex flex-col">
            {devices.map((d, i) => (
              <li key={d.id} className={cn(i > 0 && 'border-t border-surface-subtle')}>
                <SettingRow
                  className="py-2.5"
                  title={d.user_agent ?? 'Appareil'}
                  description={
                    d.last_success_at ? `Dernier envoi ${formatAgo(d.last_success_at)}` : 'Aucun envoi pour l’instant'
                  }
                  control={
                    <button type="button" className={ROW_ACTION} onClick={() => removeDevice.mutate(d.id)}>
                      Retirer
                    </button>
                  }
                />
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button variant="secondary" size="sm" loading={sendTest.isPending} onClick={() => sendTest.mutate()}>
              Envoyer une notification de test
            </Button>
            {sendTest.data && (
              <span role="status" className="text-label text-ink-2">
                {sendTest.data.sent > 0 ? 'Envoyée.' : 'Aucun appareil n’a accepté la notification.'}
              </span>
            )}
          </div>
          {sendTest.error && <Alert className="mt-2">{dataErrorMessage(sendTest.error)}</Alert>}
        </>
      )}
    </DayCard>
  )
}

// ─── Résumé du matin ────────────────────────────────────────────────────────

function MorningCard() {
  const settingsQuery = useDigestSettings()
  const update = useUpdateDigestSettings()
  const timeId = useId()
  const settings = settingsQuery.data
  if (!settings) return null
  const time = settings.send_time.slice(0, 5)

  return (
    <DayCard title="Résumé du matin" icon={<SunIcon className="size-3.5" />}>
      <SwitchRow
        title="Envoyer le résumé"
        description="Agenda, tâches, mails et anniversaires, chaque matin."
        checked={settings.enabled}
        onChange={(enabled) => update.mutate({ enabled })}
      />
      <div className="border-t border-surface-subtle">
        <SettingRow
          title={<label htmlFor={timeId}>Heure d’envoi</label>}
          description="Par quart d’heure, heure de Paris."
          control={
            <Input
              id={timeId}
              type="time"
              step={900}
              defaultValue={time}
              key={time}
              disabled={!settings.enabled}
              className="w-[8.5rem] px-3 py-2 tabular-nums"
              onBlur={(e) => {
                if (e.currentTarget.value && e.currentTarget.value !== time) {
                  update.mutate({ sendTime: e.currentTarget.value })
                }
              }}
            />
          }
        />
      </div>
      {update.error && <Alert className="mt-2">{dataErrorMessage(update.error)}</Alert>}
    </DayCard>
  )
}

// ─── Message d'anniversaire ─────────────────────────────────────────────────

function BirthdayMessageCard() {
  const settingsQuery = useDigestSettings()
  const update = useUpdateDigestSettings()
  const [draft, setDraft] = useState<string | null>(null)
  const id = useId()
  const settings = settingsQuery.data
  if (!settings) return null

  const value = draft ?? settings.birthday_message_template
  const dirty = draft !== null && draft !== settings.birthday_message_template

  return (
    <DayCard title="Message d’anniversaire" icon={<CakeIcon />}>
      <label htmlFor={id} className="mb-2 block text-label text-ink-2">
        Proposé quand vous souhaitez un anniversaire.{' '}
        <code className="rounded-xs bg-surface-subtle px-1 py-px text-ink">{'{prenom}'}</code>{' '}
        devient le prénom de la personne.
      </label>
      <Textarea
        id={id}
        rows={3}
        maxLength={500}
        value={value}
        onChange={(e) => setDraft(e.currentTarget.value)}
      />

      {dirty && (
        <div className="mt-3 flex items-center gap-2">
          <Button
            size="sm"
            loading={update.isPending}
            onClick={() => update.mutate({ template: draft }, { onSuccess: () => setDraft(null) })}
          >
            Enregistrer
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
            Annuler
          </Button>
        </div>
      )}
      {update.error && <Alert className="mt-2">{dataErrorMessage(update.error)}</Alert>}
    </DayCard>
  )
}

// ─── Synchronisation Google ─────────────────────────────────────────────────

function GoogleCard() {
  const tokensQuery = useIngestTokens()
  const settingsQuery = useDigestSettings()
  const create = useCreateIngestToken()
  const revoke = useRevokeIngestToken()
  // Le jeton en clair n'existe qu'ici, le temps que l'écran reste ouvert.
  const [fresh, setFresh] = useState<string | null>(null)
  // « Copié » vaut pour UN jeton : un nouveau jeton repart de « Copier ».
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const copied = fresh !== null && copiedToken === fresh
  const active = (tokensQuery.data ?? []).filter((t) => t.revoked_at === null)
  const atCap = active.length >= MAX_TOKENS
  const lastIngest = settingsQuery.data?.last_ingest_at ?? null

  const copy = async () => {
    if (!fresh) return
    try {
      await navigator.clipboard.writeText(fresh)
      setCopiedToken(fresh)
    } catch {
      // Presse-papiers refusé : le jeton reste sélectionnable à l'écran.
    }
  }

  return (
    <DayCard
      title="Synchronisation Google"
      icon={<RepeatIcon className="size-3.5" />}
      meta={lastIngest ? `Synchro ${formatAgo(lastIngest)}` : undefined}
    >
      <p className="mb-1 text-label text-ink-2">
        Un script dans votre compte Google envoie chaque heure votre agenda, vos mails et vos
        anniversaires. Il s’identifie avec un jeton.
      </p>

      {fresh && (
        <div className="mt-3 flex flex-col gap-2.5 rounded-lg border-[1.5px] border-border-primary-soft bg-primary-soft/40 p-3.5">
          <p className="text-label text-ink-2">
            Collez ce jeton dans les propriétés du script (<span className="font-medium">CLARITY_INGEST_TOKEN</span>).
            Il ne sera plus affiché.
          </p>
          <code className="rounded-sm bg-surface px-2.5 py-2 text-label break-all text-ink select-all">{fresh}</code>
          <div>
            <Button size="sm" variant="secondary" onClick={() => void copy()}>
              {copied ? 'Copié' : 'Copier le jeton'}
            </Button>
          </div>
        </div>
      )}

      {active.length > 0 && (
        <ul className="mt-2 flex flex-col">
          {active.map((t, i) => (
            <li key={t.id} className={cn(i > 0 && 'border-t border-surface-subtle')}>
              <SettingRow
                className="py-2.5"
                title={t.label}
                description={t.last_used_at ? `Utilisé ${formatAgo(t.last_used_at)}` : 'Jamais utilisé'}
                control={
                  <button type="button" className={ROW_ACTION} onClick={() => revoke.mutate(t.id)}>
                    Révoquer
                  </button>
                }
              />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          loading={create.isPending}
          disabled={atCap}
          onClick={() => create.mutate('Script Google', { onSuccess: setFresh })}
        >
          Générer un jeton
        </Button>
        {atCap && (
          <span className="text-label text-ink-muted">Trois jetons au plus : révoquez-en un d’abord.</span>
        )}
      </div>
      {(create.error || revoke.error) && (
        <Alert className="mt-2">{dataErrorMessage(create.error ?? revoke.error)}</Alert>
      )}
    </DayCard>
  )
}
