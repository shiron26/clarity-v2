type TasksHeaderProps = {
  title: string
  /** Rendu seulement en vue « liste ». */
  onManageLists?: () => void
}

/**
 * En-tête de page. Le desktop n'y a plus de titre : la maquette v2 le remplace
 * par les pastilles de portée de la toolbar, dans la carte (`TasksToolbar`). Le
 * déclencheur de filtres mobile est descendu lui aussi, dans
 * `TasksCardHeaderMobile`. Ne restent ici que le titre mobile et le lien
 * « Gérer les listes » d'une vue liste.
 */
export function TasksHeader({ title, onManageLists }: TasksHeaderProps) {
  // Sans titre desktop ni lien de gestion, la barre n'aurait plus rien à porter
  // sur grand écran : elle disparaît plutôt que de laisser un blanc.
  return (
    <div className={onManageLists ? 'flex items-center gap-3.5' : 'flex items-center gap-3.5 lg:hidden'}>
      <h1 className="min-w-0 truncate text-[23px] font-medium lg:hidden">{title}</h1>

      {onManageLists && (
        <button
          type="button"
          onClick={onManageLists}
          className="hidden cursor-pointer rounded-xs px-2 py-1.5 text-[11px] text-ink-muted transition-colors duration-150 hover:text-primary focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none lg:block"
        >
          ✎ Gérer les listes
        </button>
      )}
    </div>
  )
}
