import { DeckCard } from '../../../components/ritual/DeckCard'
import { DeckHeading } from '../../../components/ritual/DeckHeading'
import { taskAge } from '../../../lib/taskAge'
import type { IsoDate } from '../../../lib/appDate'
import type { Task } from '../../../hooks/useTasks'
import { DeckAction } from '../../../components/ritual/DeckAction'

type RitualTriageProps = {
  pool: Task[]
  today: IsoDate
  onDrop: (task: Task) => void
  onFinish: () => void
}

/**
 * L'écran 3 — vider le pool. Le dernier des trois moments où l'on demande
 * quelque chose ; ce qui suit est ce que le rituel rend.
 *
 * **Un seul geste : abandonner.** Garder, c'est ne rien faire — il n'y a donc
 * rien à cliquer pour ça. L'écran a d'abord porté trois boutons (garder /
 * reporter / abandonner) : les deux premiers n'écrivaient rien, et leur seule
 * différence était d'alimenter un écran « emporter » qui n'a pas tenu à l'usage.
 * Deux options indiscernables valent mieux supprimées qu'expliquées.
 *
 * Ce qui reste est l'essentiel : **remettre le backlog sous les yeux**, et rendre
 * le fait de jeter parfaitement banal. Sans ce moment, un pool non daté devient
 * un cimetière de 200 lignes et la culpabilité que la refonte enlève revient par
 * la fenêtre.
 *
 * L'âge est écrit en méta discrète et **sans rouge** — une information, jamais un
 * reproche : personne n'est en retard sur une tâche qu'il n'a jamais datée.
 */
export function RitualTriage({ pool, today, onDrop, onFinish }: RitualTriageProps) {
  const empty = pool.length === 0

  return (
    <>
      <DeckHeading
        eyebrow={
          empty ? 'Réserve vide' : `${pool.length} tâche${pool.length > 1 ? 's' : ''} en réserve`
        }
        subtitle={empty ? undefined : 'Rien ne vous oblige à les faire.'}
      >
        {empty ? <>Rien ne traîne.</> : <>Qu’est-ce qui mérite encore d’exister&nbsp;?</>}
      </DeckHeading>

      <div className="mt-5.5 flex w-full flex-col gap-2.5">
        {pool.map((task, index) => {
          const age = taskAge(task, today)

          return (
            <DeckCard key={task.id} index={index} className="flex items-center gap-3">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-body text-ink-onnight-strong">{task.title}</span>
                {age && (
                  <span className="text-caption text-ink-onnight-faint">{age.long}</span>
                )}
              </span>

              <button
                type="button"
                onClick={() => onDrop(task)}
                // Trois boutons au libellé identique : sans ce nom, un lecteur
                // d'écran annonce « Abandonner » sans dire quoi.
                aria-label={`Abandonner « ${task.title} »`}
                className="shrink-0 cursor-pointer rounded-full border-[1.5px] border-deck-idle px-3.5 py-1.5 text-label font-semibold text-ink-onnight transition-[background-color,border-color,color] duration-150 hover:border-danger hover:text-danger focus-visible:ring-3 focus-visible:ring-white/30 focus-visible:outline-none"
              >
                Abandonner
              </button>
            </DeckCard>
          )
        })}
      </div>

      <DeckAction onClick={onFinish} className="mt-6.5">
        Terminer →
      </DeckAction>
    </>
  )
}
