import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { GearIcon } from '../../../components/icons/GearIcon'
import { clearErrorLog, formatErrorLog, readErrorLog } from '../../../lib/errorLog'
import { useSyncStatus } from '../../../hooks/useSyncStatus'

/**
 * Le journal des erreurs de l'appareil (REFONTE : réveil et connectivité).
 *
 * Écran d'assistance, hors navigation : rien n'y mène dans le produit, on y va
 * par son adresse ou par un appui long sur le logo de la barre mobile. Sa raison
 * d'être est le cas qu'on ne sait pas reproduire — la panne du réveil, sur la
 * PWA installée d'un téléphone, où aucune console n'est accessible.
 *
 * Les entrées ne partent nulle part : le bouton met le texte dans le
 * presse-papiers, l'utilisateur décide de ce qu'il en fait.
 */
export function DiagnosticPage() {
  const [entries, setEntries] = useState(() => readErrorLog())
  const [copied, setCopied] = useState(false)
  const status = useSyncStatus()

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatErrorLog(entries))
      setCopied(true)
    } catch {
      // Presse-papiers refusé (contexte non sécurisé, permission) : le texte
      // reste lisible à l'écran, il n'y a rien de plus à dire.
      setCopied(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-title font-semibold">Diagnostic</h1>
        <p className="text-body text-ink-2">
          Les dernières erreurs rencontrées sur cet appareil. Elles restent ici et ne sont
          envoyées nulle part.
        </p>
      </div>

      <dl className="flex flex-wrap gap-x-8 gap-y-2 rounded-2xl bg-surface p-5 shadow-card">
        <div className="flex flex-col gap-0.5">
          <dt className="text-label text-ink-muted">Liaison</dt>
          <dd className="text-body font-medium">
            {status === 'ok' ? 'Normale' : status === 'syncing' ? 'Reconnexion' : 'Hors ligne'}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-label text-ink-muted">Erreurs enregistrées</dt>
          <dd className="text-body font-medium">{entries.length}</dd>
        </div>
      </dl>

      {entries.length === 0 ? (
        <EmptyState
          icon={<GearIcon className="size-6" />}
          title="Rien à signaler"
          description="Aucune erreur n’a été enregistrée sur cet appareil."
          action={
            <Link to="/" className="text-label font-medium text-primary">
              Retour au dashboard
            </Link>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => void copy()}>
              {copied ? 'Copié' : 'Copier le journal'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                clearErrorLog()
                setEntries([])
                setCopied(false)
              }}
            >
              Vider
            </Button>
          </div>

          {/* Contenu technique, large par nature : il défile dans sa propre boîte
              plutôt que de faire défiler la page en travers. */}
          <div className="overflow-x-auto rounded-2xl bg-surface p-5 shadow-card">
            <table className="w-full min-w-[40rem] text-left text-label">
              <thead className="text-ink-muted">
                <tr>
                  <th scope="col" className="pb-2 pr-4 font-medium">Quand</th>
                  <th scope="col" className="pb-2 pr-4 font-medium">Classe</th>
                  <th scope="col" className="pb-2 pr-4 font-medium">Code</th>
                  <th scope="col" className="pb-2 pr-4 font-medium">Appel</th>
                  <th scope="col" className="pb-2 font-medium">Message</th>
                </tr>
              </thead>
              <tbody className="align-top">
                {[...entries].reverse().map((entry) => (
                  <tr key={`${entry.at}-${entry.key}`} className="border-t border-border-strong">
                    <td className="py-2 pr-4 whitespace-nowrap text-ink-2">
                      {new Date(entry.at).toLocaleString('fr-FR')}
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap">{entry.kind}</td>
                    <td className="py-2 pr-4 whitespace-nowrap text-ink-2">
                      {entry.code ?? '·'}
                    </td>
                    <td className="py-2 pr-4 text-ink-2">{entry.key}</td>
                    <td className="py-2 text-ink-2">{entry.message ?? '·'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
