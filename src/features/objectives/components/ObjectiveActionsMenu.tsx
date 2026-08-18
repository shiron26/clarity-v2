import { useRef, useState } from 'react'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { Menu } from '../../../components/ui/Menu'
import { Modal } from '../../../components/ui/Modal'
import { useCloseObjective, useDeleteObjective } from '../../../hooks/useObjectiveMutations'
import { dataErrorMessage } from '../../../lib/errorMessage'
import type { Objective } from '../../../hooks/useObjectives'

type ObjectiveActionsMenuProps = {
  objective: Objective
  onEdit: () => void
  /** L'objectif n'existe plus : la page doit retomber sur un autre. */
  onDeleted: () => void
}

/**
 * Les actions de l'objectif, rangées dans un `⋯`.
 *
 * Elles étaient deux boutons pleins dans l'en-tête, qui pesaient autant que le
 * titre. Les ranger libère la bande pour ce qu'elle doit dire — de quoi il
 * s'agit (REFONTE §4).
 *
 * **« Arrêter » n'est pas « atteint ».** Clôturer signifie « je ne poursuis
 * plus », sans verdict : c'est le bilan du trimestre qui tranche si l'objectif a
 * été atteint (§8). D'où un libellé neutre, et aucune célébration ici.
 */
export function ObjectiveActionsMenu({ objective, onEdit, onDeleted }: ObjectiveActionsMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const closeObjective = useCloseObjective()
  const deleteObjective = useDeleteObjective()

  const stopped = objective.closed_at !== null
  const error = closeObjective.error ?? deleteObjective.error

  return (
    <>
      <div className="relative shrink-0">
        <button
          ref={triggerRef}
          type="button"
          aria-label="Actions de l’objectif"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="cursor-pointer rounded-sm px-2.5 py-1 text-[16px] leading-none text-ink-3 transition-colors duration-150 hover:bg-canvas hover:text-ink focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none"
        >
          ⋯
        </button>

        <Menu
          open={open}
          onClose={() => setOpen(false)}
          variant="actions"
          label="Actions de l’objectif"
          triggerRef={triggerRef}
          items={[
            { id: 'edit', label: 'Modifier', onSelect: onEdit },
            {
              id: 'close',
              label: stopped ? 'Reprendre' : 'Arrêter cet objectif',
              onSelect: () => closeObjective.mutate({ id: objective.id, closed: !stopped }),
            },
            {
              id: 'delete',
              label: 'Supprimer',
              tone: 'danger',
              onSelect: () => setConfirming(true),
            },
          ]}
        />
      </div>

      {error && (
        <Alert className="mt-3 w-full">{dataErrorMessage(error)}</Alert>
      )}

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Supprimer cet objectif ?"
        className="sm:w-[420px]"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              loading={deleteObjective.isPending}
              onClick={() =>
                deleteObjective.mutate(objective.id, {
                  onSuccess: () => {
                    setConfirming(false)
                    onDeleted()
                  },
                })
              }
            >
              Supprimer
            </Button>
          </div>
        }
      >
        <p className="text-body leading-relaxed text-ink-2">
          Ses étapes partent avec lui. Les tâches qui lui sont reliées restent, simplement
          détachées.
        </p>
        <p className="mt-2.5 text-body leading-relaxed text-ink-3">
          Pour garder la trace de ce qui a été fait, préférez <b>Arrêter</b> : l’objectif reste
          consultable et ses séances continuent de compter.
        </p>
      </Modal>
    </>
  )
}
