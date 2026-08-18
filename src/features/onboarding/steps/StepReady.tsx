import { CheckIcon } from '../../../components/icons/CheckIcon'
import { OnboardingShell } from '../components/OnboardingShell'

/**
 * s6 — « Tout est en place »
 *
 * On termine sur ce que l'application **rendra**, pas sur ce qu'elle attend. Le
 * titre ne parle pas d'année : un premier objectif trimestriel est un cas
 * courant, et « votre année est lancée » sonnerait faux. Et
 * on annonce tout de suite le rituel du dimanche : c'est la boucle principale du
 * produit, elle doit être posée dès la première minute.
 *
 * Aucun contrôle : c'est le seul écran purement déclaratif du parcours.
 */
const PROMISES = [
  {
    title: 'Chaque jour',
    body: 'Rien d’obligatoire. Cochez si vous voulez, quand vous voulez, même en retard.',
  },
  {
    title: 'Chaque dimanche',
    body: 'Trois minutes : ce que vous avez fait, ce que vous aviez oublié, ce que vous jetez.',
  },
  {
    title: 'À chaque trimestre',
    body: 'Un bilan : vos verdicts, et ce que vous portez les trois mois suivants.',
  },
  {
    title: 'En retour',
    body: 'Votre régularité, et la date à laquelle vous atteindrez votre objectif à ce rythme.',
  },
]

export function StepReady({ pending, onFinish }: { pending: boolean; onFinish: () => void }) {
  return (
    <OnboardingShell
      step={4}
      title="Tout est en place"
      subtitle="Voilà ce que Clarity vous demandera, et ce qu’elle vous rendra."
      actionLabel="Entrer dans Clarity"
      onAction={onFinish}
      actionDisabled={pending}
      lead={
        <span
          aria-hidden="true"
          className="mb-4.5 flex size-13 items-center justify-center rounded-xl bg-primary text-white"
        >
          <CheckIcon width="24" height="24" />
        </span>
      }
    >
      <ul className="flex flex-col gap-3.5">
        {PROMISES.map((promise) => (
          <li key={promise.title} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
            />
            <span>
              <span className="block text-ui font-semibold text-ink">{promise.title}</span>
              {/* Le dernier écran du parcours est le moins dense : ses quatre
                  promesses sont le message, pas une note de bas de page. Elles
                  se lisent donc au corps de texte, comme le sous-titre juste
                  au-dessus, et non au 11 px des aides de formulaire. */}
              <span className="mt-1 block text-body leading-relaxed text-ink-3">
                {promise.body}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </OnboardingShell>
  )
}
