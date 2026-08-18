import { PlusIcon } from '../../../components/icons/PlusIcon'
import { Button } from '../../../components/ui/Button'
import { Select } from '../../../components/ui/Select'
import { cn } from '../../../lib/cn'
import { maskTitle, objectiveSkinOf } from '../../../lib/objectivePalette'
import { MAX_PRINCIPALS, MAX_SECONDARIES, type Objective } from '../../../hooks/useObjectives'
import { SECTION_LABEL } from '../../../components/ui/sectionLabel'

export type ObjectiveRailProps = {
  /** Principaux encore portés. */
  principals: Objective[]
  /** Secondaires encore portés. */
  secondaries: Objective[]
  /** Arrêtés, toutes natures confondues. */
  stopped: Objective[]
  /**
   * Emplacements réellement occupés — arrêtés compris.
   *
   * Un objectif arrêté **garde son slot** jusqu'à la fin de sa fenêtre : les
   * contraintes d'exclusion portent sur le chevauchement de `window_range`, pas
   * sur `closed_at`. Compter les seules lignes visibles annoncerait « 2 sur 3 »
   * et ferait échouer la création en `slot_full`.
   */
  principalSlotsUsed: number
  secondarySlotsUsed: number
  selectedId: string | undefined
  onSelect: (id: string) => void
  onCreate: () => void
  /** `rail` = colonne desktop, `select` = liste déroulante mobile. */
  variant: 'rail' | 'select'
  privacy?: boolean
  readOnly?: boolean
  className?: string
}

/**
 * Le sélecteur d'objectif : trois sections en desktop, une liste déroulante au
 * doigt.
 *
 * Les deux formes ne partagent pas leur mise en page : le rail est une colonne
 * de groupes étiquetés, le mobile n'affiche que l'objectif courant. Les fondre
 * dans un seul arbre demanderait deux sous-arbres derrière des classes
 * `hidden`, c'est-à-dire deux composants avec une indirection en plus.
 *
 * En mobile, un `<select>` natif plutôt qu'une rangée de pastilles : la rangée
 * débordait hors écran (les objectifs de droite n'existaient que si on pensait
 * à faire glisser), et un choix de valeur s'y fait au sélecteur système, qui
 * ouvre la liste entière d'un coup. Prix payé : la couleur de l'objectif ne
 * peut pas vivre dans une `<option>`, elle reste sur la carte en dessous.
 */
export function ObjectiveRail({
  principals,
  secondaries,
  stopped,
  principalSlotsUsed,
  secondarySlotsUsed,
  selectedId,
  onSelect,
  onCreate,
  variant,
  privacy = false,
  readOnly = false,
  className,
}: ObjectiveRailProps) {
  if (variant === 'select') {
    // Les rangs ne s'annoncent que s'il y en a plusieurs à distinguer : un
    // `<optgroup>` seul au-dessus de la liste entière ne trie rien.
    const groups = [
      { label: 'Principaux', items: principals },
      { label: 'Secondaires', items: secondaries },
      { label: 'Arrêtés', items: stopped },
    ].filter((group) => group.items.length > 0)

    const option = (objective: Objective) => (
      <option key={objective.id} value={objective.id}>
        {privacy ? maskTitle(objective.title) : objective.title}
      </option>
    )

    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Select
          aria-label="Objectif affiché"
          value={selectedId ?? ''}
          onChange={(event) => onSelect(event.target.value)}
          fullWidth
          // `min-w-0` : sans lui, la largeur intrinsèque du select (celle de son
          // option la plus longue) l'emporte sur `flex-1` et pousse le bouton
          // hors de l'écran.
          wrapperClassName="min-w-0 flex-1"
        >
          {groups.map((group) =>
            groups.length > 1 ? (
              <optgroup key={group.label} label={group.label}>
                {group.items.map(option)}
              </optgroup>
            ) : (
              group.items.map(option)
            ),
          )}
        </Select>

        {/* Sans lui, l'écran Objectifs n'offre AUCUN chemin de création en
            mobile dès qu'un objectif existe : l'état vide disparaît et le
            bouton du rail est réservé au desktop. */}
        {!readOnly && (
          <Button onClick={onCreate} size="lg" className="shrink-0">
            <PlusIcon className="size-4" />
            Objectif
          </Button>
        )}
      </div>
    )
  }

  return (
    // Collant : la colonne reste sous la main pendant qu'on parcourt un détail
    // long. `main` est le conteneur défilant (AppShell), et un item de grille
    // colle dans SA zone de grille — qui, elle, fait la hauteur de la rangée.
    <nav
      aria-label="Vos objectifs"
      className={cn('flex flex-col lg:sticky lg:top-0', className)}
    >
      <RailGroup
        label="Principaux"
        count={`${principalSlotsUsed}/${MAX_PRINCIPALS}`}
        empty={principals.length === 0}
        first
      >
        {principals.map((objective) => (
          <RailItem
            key={objective.id}
            objective={objective}
            selected={objective.id === selectedId}
            onSelect={onSelect}
            privacy={privacy}
          />
        ))}
      </RailGroup>

      <RailGroup
        label="Secondaires"
        count={`${secondarySlotsUsed}/${MAX_SECONDARIES}`}
        empty={secondaries.length === 0}
      >
        {secondaries.map((objective) => (
          <RailItem
            key={objective.id}
            objective={objective}
            selected={objective.id === selectedId}
            onSelect={onSelect}
            privacy={privacy}
          />
        ))}
      </RailGroup>

      {/* La section ne paraît que s'il y a quelque chose dedans : une rubrique
          « Arrêtés » vide se lirait comme un reproche en attente. */}
      {stopped.length > 0 && (
        <RailGroup label="Arrêtés">
          {stopped.map((objective) => (
            <RailItem
              key={objective.id}
              objective={objective}
              selected={objective.id === selectedId}
              onSelect={onSelect}
              privacy={privacy}
            />
          ))}
        </RailGroup>
      )}

      {/* La seule action de la colonne : elle se donne comme telle, en bleu
          plein. Une ligne fantôme de plus se serait rangée avec les objectifs
          qu'elle sert à créer, et c'est le seul chemin de création au desktop. */}
      {!readOnly && (
        <Button onClick={onCreate} size="lg" fullWidth className="mt-5 rounded-xl">
          <PlusIcon className="size-4" />
          Nouvel objectif
        </Button>
      )}
    </nav>
  )
}

/**
 * Un groupe : son intitulé à gauche, ses places à droite, un filet au-dessus.
 *
 * Le compte est une fraction (`1/5`) plutôt qu'une phrase : il se lit d'un coup
 * d'œil et tient dans la gouttière de droite, là où une phrase forcerait le
 * retour à la ligne dès qu'un intitulé s'allonge.
 */
function RailGroup({
  label,
  count,
  empty = false,
  first = false,
  children,
}: {
  label: string
  count?: string
  /** Le vide est **déclaré**, jamais deviné en inspectant `children`. */
  empty?: boolean
  first?: boolean
  children: React.ReactNode
}) {
  return (
    <section className={cn(!first && 'mt-4 border-t border-border pt-4')}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 px-3">
        <h2 className={SECTION_LABEL}>
          {label}
        </h2>
        {count && (
          <span className="text-micro font-semibold text-ink-muted tabular-nums">{count}</span>
        )}
      </div>

      {/* Une section vide dit qu'elle est vide : sans cette ligne, l'intitulé
          flotte au-dessus du filet suivant et se lit comme un chargement. */}
      {empty ? (
        <p className="px-3 py-1 text-body text-ink-muted">Aucun pour l'instant</p>
      ) : (
        <div className="flex flex-col gap-0.5">{children}</div>
      )}
    </section>
  )
}

type ItemProps = {
  objective: Objective
  selected: boolean
  onSelect: (id: string) => void
  privacy: boolean
}

/**
 * Sélectionné = la ligne se soulève en carte blanche, comme le panneau de
 * droite ; sa pastille prend un halo de sa propre couleur. Aucun contour bleu :
 * le bleu est le signal d'action de l'UI (DESIGN.md), pas celui d'un choix déjà
 * fait, et un liseré vif sur fond clair donne au rail l'allure d'un champ de
 * formulaire.
 */
function RailItem({ objective, selected, onSelect, privacy }: ItemProps) {
  const stopped = objective.closed_at !== null
  const hue = stopped ? 'var(--color-border-strong)' : objectiveSkinOf(objective).hue
  const title = privacy ? maskTitle(objective.title) : objective.title

  return (
    <button
      type="button"
      onClick={() => onSelect(objective.id)}
      aria-pressed={selected}
      className={cn(
        'flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors duration-150',
        'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
        selected ? 'bg-surface shadow-card' : 'hover:bg-surface',
      )}
    >
      <span
        className="size-2 shrink-0 rounded-full transition-shadow duration-150"
        style={{
          backgroundColor: hue,
          boxShadow: selected ? `0 0 0 3.5px color-mix(in srgb, ${hue} 22%, transparent)` : undefined,
        }}
      />
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-ui',
          selected ? 'font-semibold text-ink' : 'font-medium text-ink-2',
          stopped && !selected && 'text-ink-muted',
        )}
      >
        {title}
      </span>
      {stopped && (
        <span className="shrink-0 text-micro font-medium text-ink-muted">Arrêté</span>
      )}
    </button>
  )
}
