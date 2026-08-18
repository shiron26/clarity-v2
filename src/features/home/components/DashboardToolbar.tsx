import { createPortal } from 'react-dom'
import { GearIcon } from '../../../components/icons/GearIcon'
import { PlusIcon } from '../../../components/icons/PlusIcon'
import { Button } from '../../../components/ui/Button'
import { Kbd } from '../../../components/ui/Kbd'
import { useTopBarSlot } from '../../../components/layout/topBarSlot'
import { useNewTask } from '../../../hooks/useNewTask'

/**
 * Les actions d'écran du dashboard.
 *
 * Sous `lg` elles remontent dans la barre mobile par portail — le shell prête un
 * nœud du DOM parce qu'il n'a pas le droit de consommer le contexte de la
 * feature (voir `topBarSlot.ts`). « Nouvelle tâche » disparaît alors : le bouton
 * flottant de la barre d'onglets fait déjà le travail.
 *
 * « Masquer » n'est plus ici : il agit sur les quatre écrans, il vit donc dans
 * la coquille (`PrivacyToggle`). Posé sur cette barre, il obligeait à revenir
 * sur l'accueil pour redonner leurs titres aux objectifs.
 */
export function DashboardToolbar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const topBarSlot = useTopBarSlot()
  const { openNewTask } = useNewTask()

  return (
    <>
      <div className="hidden justify-end gap-2.5 lg:flex">
        <button
          type="button"
          onClick={onOpenSettings}
          title="Paramétrer le dashboard"
          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface px-3.5 py-2 text-body font-medium text-ink-2 transition-colors duration-150 hover:border-border-primary-soft hover:text-primary focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none"
        >
          <GearIcon className="size-3.5" />
          <span className="hidden sm:inline">Réglages</span>
        </button>

        <Button onClick={openNewTask} aria-keyshortcuts="N" title="Raccourci : N" className="gap-1.5">
          <PlusIcon className="size-3.5" />
          Nouvelle tâche
          <Kbd className="ml-0.5">N</Kbd>
        </Button>
      </div>

      {/* Le même réglage, rendu dans la barre mobile à côté de la déconnexion.
          Il s'aligne sur son bouton — icône nue, pas de cartouche bordée. */}
      {topBarSlot &&
        createPortal(
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Paramétrer le dashboard"
            title="Paramétrer le dashboard"
            className="flex size-8 cursor-pointer items-center justify-center rounded-sm text-ink-muted transition-colors duration-150 hover:text-primary focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none"
          >
            <GearIcon className="size-4" />
          </button>,
          topBarSlot,
        )}
    </>
  )
}
