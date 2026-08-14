import { Link } from 'react-router'

/**
 * Rien à noter tant qu'il n'y a pas d'objectif : la review juge des objectifs,
 * pas des tâches. L'issue de secours pointe donc vers l'écran Objectifs.
 */
export function ReviewEmpty() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3.5 rounded-2xl border-[1.5px] border-dashed border-border-strong bg-surface px-5 py-12 text-center lg:py-16">
      <span className="flex size-12 items-center justify-center rounded-[15px] bg-night text-[20px] text-white lg:size-13 lg:rounded-xl lg:text-[22px]">
        ▲
      </span>
      <h2 className="text-[16px] font-semibold lg:text-title">
        Votre première review vous attend
      </h2>
      <p className="max-w-105 text-[12px] leading-relaxed text-ink-faint lg:text-body">
        Dès que vous aurez un objectif et quelques tâches, vous pourrez noter votre semaine en
        deux minutes.
      </p>
      <Link
        to="/objectifs"
        className="mt-2 cursor-pointer rounded-lg bg-primary px-5.5 py-3.5 text-body font-medium text-white shadow-primary transition-all duration-150 hover:-translate-y-px hover:bg-primary-hover hover:shadow-primary-hover active:translate-y-px active:bg-primary-active focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none"
      >
        Commencer par un objectif
      </Link>
    </div>
  )
}
