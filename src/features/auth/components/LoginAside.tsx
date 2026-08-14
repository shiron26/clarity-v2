import { ObjectivePreviewCard } from './ObjectivePreviewCard'
import { TaskPreviewRow } from './TaskPreviewRow'

const TASKS = [
  { title: 'Sortie longue 18 km', tag: 'Marathon', hue: '#2f8bff', done: true },
  { title: 'Maquette de l’atelier', tag: 'Atelier', hue: '#c44dff', done: true },
  { title: 'Lire 30 pages', tag: 'Lecture', hue: '#2aeb8d', done: false },
  { title: 'Réserver le dentiste', hue: '#7c8097', done: false },
]

// Panneau illustratif de la page de connexion. Contenu figé, purement décoratif.
export function LoginAside() {
  return (
    <div className="flex flex-col gap-7">
      <div>
        <div className="text-[11px] font-semibold tracking-[1.5px] text-ink-onnight">
          CETTE SEMAINE
        </div>
        <div className="mt-3.5 text-[22px] leading-[1.35] font-semibold text-white">
          Trois objectifs.
          <br />
          Un rythme.
          <br />
          Aucune dispersion.
        </div>
      </div>

      <ObjectivePreviewCard
        title="Lire 24 livres"
        meta="Mensuel"
        done={11}
        target={24}
        gradient="linear-gradient(120deg,#009e54,#2aeb8d)"
        core="#00874a"
      />

      <div className="rounded-xl bg-night-soft px-4 py-3.5">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-caption font-semibold tracking-[1.3px] text-ink-onnight">
            AUJOURD’HUI
          </span>
          <span className="text-caption text-[#565866]">2 / 5 faites</span>
        </div>
        <div className="flex flex-col">
          {TASKS.map((task, i) => (
            <TaskPreviewRow
              key={task.title}
              surface="night"
              last={i === TASKS.length - 1}
              {...task}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
