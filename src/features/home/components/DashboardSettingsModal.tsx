import { Modal } from '../../../components/ui/Modal'
import { Switch } from '../../../components/ui/Switch'
import { PREF_ROWS } from '../dashboardPrefs'
import { useDashboardPrefs } from '../useDashboardPrefs'

type DashboardSettingsModalProps = {
  open: boolean
  onClose: () => void
}

export function DashboardSettingsModal({ open, onClose }: DashboardSettingsModalProps) {
  const { prefs, togglePref } = useDashboardPrefs()

  return (
    <Modal open={open} onClose={onClose} title="Réglages du dashboard">
      <p className="mb-4 text-label text-ink-muted">
        Choisissez ce qui s’affiche sur votre dashboard. Ces réglages restent sur cet appareil.
      </p>

      <div className="flex flex-col gap-0.5">
        {PREF_ROWS.map((row) => (
          <div
            key={row.key}
            className="flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-canvas"
          >
            <div className="min-w-0 flex-1">
              <div className="text-body font-medium text-ink">{row.label}</div>
              <div className="mt-0.5 text-caption text-ink-muted">{row.hint}</div>
            </div>
            <Switch
              checked={prefs[row.key]}
              onChange={() => togglePref(row.key)}
              label={row.label}
            />
          </div>
        ))}
      </div>
    </Modal>
  )
}
