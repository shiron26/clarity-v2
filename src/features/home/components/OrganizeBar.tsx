import { createPortal } from 'react-dom'
import { Button } from '../../../components/ui/Button'
import { usePageBannerSlot } from '../../../components/layout/pageBannerSlot'

/**
 * La barre du mode Organiser : ce qu'on peut faire, et la seule façon d'en sortir.
 *
 * Elle a remplacé une bannière posée dans le flux, qui défilait avec la page et
 * laissait le bouton « Terminé » hors de l'écran dès qu'on descendait vers les
 * widgets qu'on venait réorganiser. Le header de la page se tait pendant ce
 * temps-là (`DashboardToolbar`) : deux sorties pour un même mode se lisent comme
 * deux actions différentes.
 *
 * Elle se rend HORS de la zone qui défile, par portail dans l'emplacement que
 * la coquille prête (`pageBannerSlot.ts`). Posée dans le `<main>` en `sticky`,
 * elle butait sur le `padding` du conteneur de défilement : une bande de fond
 * restait visible au-dessus d'elle dès qu'on faisait défiler, et le titre de la
 * première section se glissait dessous. Là, elle occupe simplement le haut de la
 * colonne : pleine largeur, sans marge négative, sans `z-index`, et le contenu
 * commence en dessous au lieu de passer derrière.
 *
 * Deux choses la font lire comme un MODE et pas comme une carte de plus :
 *
 * - le fond bleu clair : c'est le seul emploi de `primary-soft` en pleine
 *   largeur du produit, et c'est voulu, on n'est pas dans l'accueil ordinaire ;
 * - le contenu CENTRÉ, sur une seule ligne. Étalé d'un bord à l'autre, il
 *   laissait un couloir vide au milieu sur un grand écran, ce qui donnait à la
 *   barre l'air d'un espace perdu plutôt que d'une bannière.
 *
 * La phrase ne dit QUE le geste qu'on ne devine pas. La largeur et le retrait
 * ont chacun leur contrôle visible sur la carte, les redire ici les répéterait.
 */
export function OrganizeBar({
  onAddWidget,
  onDone,
}: {
  onAddWidget: () => void
  onDone: () => void
}) {
  const slot = usePageBannerSlot()
  if (!slot) return null

  return createPortal(
    <div className="border-b border-border-primary-soft bg-primary-soft px-5 py-2.5 lg:px-8">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
        {/* La poignée, en pastille : l'icône répète exactement ce qu'on vient de
            rendre visible sur chaque carte, et c'est ce raccord qui apprend le
            geste. Un engrenage aurait nommé le réglage, pas le glissement. */}
        <span
          aria-hidden
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-surface text-[13px] leading-none text-primary"
        >
          ⠿
        </span>
        <p className="text-body">
          <span className="font-semibold">Organisez votre accueil</span>{' '}
          <span className="text-ink-2">
            Prenez une carte par sa poignée pour la déplacer.
          </span>
        </p>
        <Button variant="secondary" size="sm" onClick={onAddWidget}>
          Ajouter un widget
        </Button>
        <Button size="sm" onClick={onDone}>
          Terminé
        </Button>
      </div>
    </div>,
    slot,
  )
}
