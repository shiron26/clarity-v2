import { useEffect, useState } from 'react'
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

  function move(id: string, delta: number) {
    const ids = ownLists.map((l) => l.id)
    const from = ids.indexOf(id)
    const to = from + delta
    if (from < 0 || to < 0 || to >= ids.length) return
    ids.splice(from, 1)
    ids.splice(to, 0, id)
    reorderLists.mutate({ orderedIds: ids, positions: new Map(ownLists.map((l) => [l.id, l.position])) })
  }

  const error = createList.error ?? updateList.error ?? deleteList.error ?? reorderLists.error

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Gérer les listes"
      variant="sheet"
      className="sm:w-[560px]"
    >
      <ul className="flex flex-col gap-3">
        {ownLists.map((list, index) => (
          <li
            key={list.id}
            className="flex flex-col gap-2.5 rounded-lg bg-canvas p-3 lg:flex-row lg:items-center lg:gap-3"
          >
            <div className="flex items-center gap-2.5 lg:contents">
              {/* La maquette glisse à la souris ; ici deux boutons font le même
                  travail et restent accessibles au clavier. */}
              <span className="flex shrink-0 flex-col lg:order-first">
                <button
                  type="button"
                  aria-label={`Monter ${list.name}`}
                  disabled={index === 0}
                  onClick={() => move(list.id, -1)}
                  className="cursor-pointer px-1 text-[9px] leading-none text-border-idle transition-colors duration-150 hover:text-ink-muted disabled:cursor-default disabled:opacity-40"
                >
                  <span aria-hidden>▴</span>
                </button>
                <button
                  type="button"
                  aria-label={`Descendre ${list.name}`}
                  disabled={index === ownLists.length - 1}
                  onClick={() => move(list.id, 1)}
                  className="cursor-pointer px-1 text-[9px] leading-none text-border-idle transition-colors duration-150 hover:text-ink-muted disabled:cursor-default disabled:opacity-40"
                >
                  <span aria-hidden>▾</span>
                </button>
              </span>

              <input
                defaultValue={list.name}
                aria-label={`Nom de la liste ${list.name}`}
                onBlur={(event) => {
                  const name = event.target.value.trim()
                  if (name && name !== list.name) updateList.mutate({ id: list.id, edits: { name } })
                  else event.target.value = list.name
                }}
                className="min-w-0 flex-1 rounded-md border-[1.5px] border-border bg-surface px-3 py-2.5 text-[12.5px] text-ink outline-none focus:border-primary"
              />

              <button
                type="button"
                aria-label={`Supprimer la liste ${list.name}`}
                onClick={() => {
                  if (confirmingId !== list.id) {
                    setConfirmingId(list.id)
                    return
                  }
                  deleteList.mutate(list.id, { onSuccess: () => setConfirmingId(null) })
                }}
                className={cn(
                  'flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-sm text-[11px]',
                  'transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
                  confirmingId === list.id
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
              onChange={(color) => updateList.mutate({ id: list.id, edits: { color } })}
              className="pl-6 lg:order-first lg:pl-0"
            />

            {confirmingId === list.id && (
              <p className="text-caption leading-snug text-ink-muted lg:w-full">
                Cliquez à nouveau pour supprimer. Les tâches de cette liste sont conservées, elles
                en sortent simplement.
              </p>
            )}
          </li>
        ))}
      </ul>

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
