import { CheckIcon } from '../../../components/icons/CheckIcon'
import { Logo } from '../../../components/brand/Logo'
import { TaskPreviewRow } from './TaskPreviewRow'

const POINTS = [
  {
    title: 'Trois objectifs principaux',
    body: 'Le reste passe en secondaire, rangé mais toujours là.',
  },
  {
    title: 'Une review de deux minutes',
    body: 'Chaque dimanche, vous notez votre régularité.',
  },
]

const TASKS = [
  { title: 'Sortie longue 18 km', done: true },
  { title: 'Maquette de l’atelier', done: true },
  { title: 'Lire 30 pages', done: false },
]

// Panneau illustratif de la page d'inscription. Contenu figé, purement décoratif.
export function SignupAside() {
  return (
    <div className="flex flex-col gap-10">
      <div>
        <Logo tone="onPrimary" size="lg" />
        <div className="mt-10 text-[23px] leading-[1.35] font-semibold text-white">
          Choisissez trois objectifs qui comptent vraiment.
        </div>
      </div>

      <div className="flex flex-col gap-[18px]">
        {POINTS.map((point) => (
          <div key={point.title} className="flex items-start gap-3">
            <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-white/22 text-white">
              <CheckIcon className="size-2.5" />
            </span>
            <div>
              <div className="text-body font-semibold text-white">{point.title}</div>
              <div className="mt-[3px] text-[11.5px] leading-relaxed text-white/72">
                {point.body}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-white/12 px-4 py-3.5">
        <div className="mb-1 text-caption font-semibold tracking-[1.3px] text-white/70">
          VOS TÂCHES DU JOUR
        </div>
        <div className="flex flex-col">
          {TASKS.map((task, i) => (
            <TaskPreviewRow
              key={task.title}
              surface="primary"
              last={i === TASKS.length - 1}
              {...task}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
