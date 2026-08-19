import { createPortal } from 'react-dom'
import { GearIcon } from '../../../components/icons/GearIcon'
import { PlusIcon } from '../../../components/icons/PlusIcon'
import { Button } from '../../../components/ui/Button'
import { Kbd } from '../../../components/ui/Kbd'
import { useTopBarSlot } from '../../../components/layout/topBarSlot'
import { useNewTask } from '../../../hooks/useNewTask'
import { cn } from '../../../lib/cn'

/**
 * Les actions d'écran du dashboard.
 *
 * « Organiser » a remplacé « Réglages » : les préférences de l'accueil SONT sa
 * disposition, il n'y a plus d'autre réglage à ouvrir.
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
export function DashboardToolbar({
  editing,
  onToggleEditing,
}: {
  editing: boolean
  onToggleEditing: () => void
}) {
  const topBarSlot = useTopBarSlot()
  const { openNewTask } = useNewTask()

  return (
    <>
      <div className="hidden justify-end gap-2.5 lg:flex">
        <button
          type="button"
          onClick={onToggleEditing}
          aria-pressed={editing}
          title="Organiser votre accueil"
          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface px-3.5 py-2 text-body font-medium text-ink-2 transition-colors duration-150 hover:border-border-primary-soft hover:text-primary focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none"
        >
          <GearIcon className="size-3.5" />
          <span className="hidden sm:inline">{editing ? 'Terminé' : 'Organiser'}</span>
        </button>

        <Button onClick={openNewTask} aria-keyshortcuts="N" title="Raccourci : N" className="gap-1.5">
          <PlusIcon className="size-3.5" />
          Nouvelle tâche
          <Kbd className="ml-0.5">N</Kbd>
        </Button>
      </div>

      {/* La même action, rendue dans la barre mobile à côté de la déconnexion.
          Elle s'aligne sur son bouton — icône nue, pas de cartouche bordée. */}
      {topBarSlot &&
        createPortal(
          <button
            type="button"
            onClick={onToggleEditing}
            aria-pressed={editing}
            aria-label="Organiser votre accueil"
            title="Organiser votre accueil"
            className={cn(
              'flex size-8 cursor-pointer items-center justify-center rounded-sm transition-colors duration-150',
              'hover:text-primary focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
              editing ? 'text-primary' : 'text-ink-muted',
            )}
          >
            <GearIcon className="size-4" />
          </button>,
          topBarSlot,
        )}
    </>
  )
}
