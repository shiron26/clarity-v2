import { objectiveSkinOf } from '../../../lib/objectivePalette'
import { cadenceQuestion, targetReassurance, type CadenceOffer } from '../comebackContent'
import { DeckAction } from '../../../components/ritual/DeckAction'
import { DeckEyebrow } from '../../../components/ritual/DeckEyebrow'

type CadenceOfferDeckProps = {
  offer: CadenceOffer
  onAccept: () => void
  onKeep: () => void
  pending: boolean
}

/**
 * L'ajustement de rythme — **un écran par objectif concerné**.
 *
 * Une pastille « Alléger : 3 → 2×/semaine » serait trop comprimée pour être
 * comprise : ni de quel objectif on parle, ni pourquoi. Or changer un réglage
 * *est* une décision, et dans ce produit une décision mérite son écran.
 *
 * Tout est levé sans un mot de trop : le sur-titre nomme l'objectif, le chiffre
 * montre le changement, la question est posée telle quelle, et **la seule crainte
 * réelle** — « est-ce que je renonce ? » — reçoit sa réponse en une ligne.
 *
 * L'écran ne parlant que d'un objectif, il en **porte l'identité** : pastille et
 * titre à sa couleur de slot, nouvelle cadence dans son dégradé. Le bleu reste au
 * bouton seul — une seule couleur d'action (`DESIGN.md`).
 */
export function CadenceOfferDeck({ offer, onAccept, onKeep, pending }: CadenceOfferDeckProps) {
  const { objective, from, to } = offer
  const skin = objectiveSkinOf(objective)

  return (
    <>
      <DeckEyebrow className="animate-slide-up flex items-center justify-center gap-2.5">
        <span aria-hidden className="size-[9px] rounded-full" style={{ backgroundColor: skin.hue }} />
        <span style={{ color: skin.hue }}>{objective.title}</span>
      </DeckEyebrow>

      <p
        className="animate-num-in mt-4.5 text-[68px] leading-[0.92] font-bold tracking-[-2px] lg:text-[82px]"
        style={{ animationDelay: '0.15s' }}
      >
        {/* L'ancienne cadence s'éteint, elle ne se barre pas : on ne raye pas ce
            qui a été tenté. */}
        <span className="text-ink-onnight-faint">{from}</span>
        <span className="text-[36px] text-ink-onnight-faint lg:text-[44px]"> → </span>
        <span
          className="bg-clip-text text-transparent"
          style={{ backgroundImage: skin.gradient }}
        >
          {to}
        </span>
      </p>

      <h2
        className="animate-slide-up mt-3.5 text-[19px] leading-snug font-semibold text-white lg:text-[22px]"
        style={{ animationDelay: '0.35s' }}
      >
        <span className="sr-only">
          Passer de {from} à {to}{' '}
        </span>
        {cadenceQuestion(objective)}&nbsp;?
      </h2>

      <p
        className="animate-slide-up mt-2.5 text-body leading-relaxed text-ink-onnight"
        style={{ animationDelay: '0.55s' }}
      >
        Le temps de reprendre.
        <br />
        {targetReassurance(objective)}
      </p>

      {/* Deux gestes de poids INÉGAL, et c'est voulu : accepter écrit quelque
          chose, garder n'écrit rien. Leur donner le même poids ferait croire à
          deux réglages symétriques. */}
      <DeckAction
        onClick={onAccept}
        disabled={pending}
        className="mt-7.5"
      >
        Passer à {to} séances
      </DeckAction>

      <button
        type="button"
        onClick={onKeep}
        className="animate-slide-up mt-4 cursor-pointer rounded-xs p-1.5 text-body text-ink-onnight transition-colors duration-150 hover:text-ink-onnight-strong focus-visible:ring-3 focus-visible:ring-white/30 focus-visible:outline-none"
      >
        Garder {from} séances
      </button>
    </>
  )
}
