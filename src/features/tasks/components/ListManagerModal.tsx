import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert } from '../../../components/ui/Alert'
import { ColorSwatches } from '../../../components/ui/ColorSwatches'
import { Modal } from '../../../components/ui/Modal'
import { useAuth } from '../../auth/useAuth'
import type { List } from '../../../hooks/useLists'
import {
  useCreateList,
  useDeleteList,
  useReorderLists,
  useUpdateList,
} from '../../../hooks/useListMutations'
import { cn } from '../../../lib/cn'
import { dataErrorMessage } from '../../../lib/errorMessage'
import { LIST_PALETTE, nextListColor } from '../../../lib/listPalette'
import { buttonClasses } from '../../../components/ui/buttonClasses'
import { DragHandle } from '../../../components/dnd/DragHandle'
import { SortableContainer } from '../../../components/dnd/SortableContainer'
import { useSortableItem } from '../../../components/dnd/useSortableItem'

type ListManagerModalProps = {
  open: boolean
  onClose: () => void
  lists: List[]
}

export function ListManagerModal({ open, onClose, lists }: ListManagerModalProps) {
  const { session } = useAuth()
  const userId = session?.user.id

  const createList = useCreateList()
  const updateList = useUpdateList()
  const deleteList = useDeleteList()
  const reorderLists = useReorderLists()

  // Le gestionnaire ne touche qu'aux listes personnelles : celles d'un espace se
  // gèrent dans le contexte de l'espace (SPEC §3).
  const ownLists = lists.filter((l) => l.space_id === null)

  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState<string>(LIST_PALETTE[0])
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setNewName('')
    setNewColor(nextListColor(ownLists.length))
    setConfirmingId(null)
    // Une seule remise à zéro, à l'ouverture : `ownLists` change à chaque écriture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function addList() {
    const name = newName.trim()
    if (!name || !userId) return
    createList.mutate(
      { userId, name, color: newColor, position: ownLists.length },
      {
        onSuccess: () => {
          setNewName('')
          setNewColor(nextListColor(ownLists.length + 1))
        },
      },
    )
  }

  const byId = useMemo(() => new Map(ownLists.map((l) => [l.id, l])), [ownLists])
  const ids = useMemo(() => ownLists.map((l) => l.id), [ownLists])

  const handleReorder = useCallback(
    (orderedIds: string[]) => {
      // La carte des positions s'évalue ici, donc avant que `onMutate` réécrive
      // le cache : ce sont bien les positions serveur d'avant le geste, seules
      // capables de dire quelles lignes ont réellement bougé.
      reorderLists.mutate({
        orderedIds,
        positions: new Map(ownLists.map((l) => [l.id, l.position])),
      })
    },
    [reorderLists, ownLists],
  )

  const error = createList.error ?? updateList.error ?? deleteList.error ?? reorderLists.error

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Gérer les listes"
      variant="sheet"
      className="sm:w-[560px]"
    >
      <SortableContainer
        ids={ids}
        labelOf={(id) => byId.get(id)?.name ?? 'Liste'}
        onReorder={handleReorder}
        renderOverlay={(id) => {
          const list = byId.get(id)
          if (!list) return null
          // Un aperçu en lecture seule : remonter le vrai champ ferait exister
          // deux entrées de même valeur, et le focus clignoterait entre elles.
          return (
            <ul>
              <li className="flex items-center gap-2.5 rounded-lg bg-canvas p-3 shadow-modal">
                <span aria-hidden className="px-0.5 text-[12px] leading-none text-primary">
                  ⠿
                </span>
                <span
                  aria-hidden
                  className="size-3.5 shrink-0 rounded-full"
                  style={{ backgroundColor: list.color ?? LIST_PALETTE[0] }}
                />
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{list.name}</span>
              </li>
            </ul>
          )
        }}
      >
        {(order) => (
          <ul className="flex flex-col gap-3">
            {order.map((id) => {
              const list = byId.get(id)
              if (!list) return null
              return (
                <SortableListRow
                  key={id}
                  list={list}
                  confirming={confirmingId === id}
                  onRename={(name) => updateList.mutate({ id, edits: { name } })}
                  onRecolor={(color) => updateList.mutate({ id, edits: { color } })}
                  onDelete={() => {
                    if (confirmingId !== id) {
                      setConfirmingId(id)
                      return
                    }
                    deleteList.mutate(id, { onSuccess: () => setConfirmingId(null) })
                  }}
                />
              )
            })}
          </ul>
        )}
      </SortableContainer>

      {error && <Alert className="mt-3">{dataErrorMessage(error)}</Alert>}

      <div className="mt-4.5 flex flex-col gap-3 border-t border-surface-subtle pt-4">
        <ColorSwatches
          label="Couleur de la nouvelle liste"
          value={newColor}
          onChange={setNewColor}
        />
        <div className="flex gap-2.5">
          <input
            value={newName}
            placeholder="Nouvelle liste…"
            aria-label="Nom de la nouvelle liste"
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') addList()
            }}
            className="min-w-0 flex-1 rounded-md border-[1.5px] border-border bg-surface px-3 py-2.5 text-[12.5px] text-ink outline-none placeholder:text-placeholder focus:border-primary"
          />
          <button
            type="button"
            onClick={addList}
            disabled={!newName.trim() || createList.isPending}
            className={buttonClasses({ className: 'shrink-0 px-4.5 py-2.5 text-[12px]' })}
          >
            Ajouter
          </button>
        </div>
      </div>
    </Modal>
  )
}

/**
 * Une ligne du gestionnaire. Composant à part parce que le glissement se
 * branche par un hook, et qu'un hook ne s'appelle pas dans une boucle.
 * Volontairement non exporté : il ne sert qu'ici.
 */
function SortableListRow({
  list,
  confirming,
  onRename,
  onRecolor,
  onDelete,
}: {
  list: List
  confirming: boolean
  onRename: (name: string) => void
  onRecolor: (color: string) => void
  onDelete: () => void
}) {
  const { setNodeRef, style, handleProps, isDragging } = useSortableItem({
    id: list.id,
    roleDescription: 'liste déplaçable',
  })

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex flex-col gap-2.5 rounded-lg bg-canvas p-3 lg:flex-row lg:items-center lg:gap-3',
        isDragging && 'opacity-35',
      )}
    >
      <div className="flex items-center gap-2.5 lg:contents">
        {/* Ton `solid` comme le mode Organiser de l'accueil, et pour la même
            raison : on n'ouvre pas cette fenêtre pour lire ses listes, on
            l'ouvre pour les ranger. La poignée d'une ligne de tâche peut se
            taire, celle-ci doit se voir. */}
        <DragHandle
          label={`Déplacer ${list.name}`}
          handleProps={handleProps}
          active={isDragging}
          tone="solid"
          className="lg:order-first"
        />

        <input
          defaultValue={list.name}
          aria-label={`Nom de la liste ${list.name}`}
          onBlur={(event) => {
            const name = event.target.value.trim()
            if (name && name !== list.name) onRename(name)
            else event.target.value = list.name
          }}
          className="min-w-0 flex-1 rounded-md border-[1.5px] border-border bg-surface px-3 py-2.5 text-[12.5px] text-ink outline-none focus:border-primary"
        />

        <button
          type="button"
          aria-label={`Supprimer la liste ${list.name}`}
          onClick={onDelete}
          className={cn(
            'flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-sm text-[11px]',
            'transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
            confirming
              ? 'bg-danger-bg text-danger'
              : 'text-ink-muted hover:bg-danger-bg hover:text-danger',
          )}
        >
          <span aria-hidden>✕</span>
        </button>
      </div>

      <ColorSwatches
        label={`Couleur de la liste ${list.name}`}
        value={list.color ?? LIST_PALETTE[0]}
        onChange={onRecolor}
        // L'indentation suit la largeur de la poignée : 28 px, plus le gap de 10.
        className="pl-9.5 lg:order-first lg:pl-0"
      />

      {confirming && (
        <p className="text-caption leading-snug text-ink-muted lg:w-full">
          Cliquez à nouveau pour supprimer. Les tâches de cette liste sont conservées, elles en
          sortent simplement.
        </p>
      )}
    </li>
  )
}
