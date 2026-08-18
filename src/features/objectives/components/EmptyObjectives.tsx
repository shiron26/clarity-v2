import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ObjectivesIcon } from '../../../components/icons/ObjectivesIcon'

/**
 * L'écran sans aucun objectif — le seul endroit où l'invitation a le droit
 * d'occuper toute la place, puisqu'il n'y a rien d'autre à concurrencer
 * (REFONTE §3 : une bordure pointillée ne se pose jamais à côté d'un contenu
 * existant, elle s'y lirait comme un manque).
 */
export function EmptyObjectives({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyState
      icon={<ObjectivesIcon className="size-6" />}
      title="Posez votre premier objectif"
      description="Choisissez ce qui décidera si votre année a compté. Vos tâches viendront s’y relier, et chaque semaine vous verrez votre régularité."
      action={
        <Button size="lg" onClick={onCreate}>
          Créer mon premier objectif
        </Button>
      }
      className="flex-1"
    />
  )
}
