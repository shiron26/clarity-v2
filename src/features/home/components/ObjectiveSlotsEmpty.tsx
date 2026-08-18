import { Link } from 'react-router'
import { objectiveSkin, PRINCIPAL_SLOTS } from '../../../lib/objectivePalette'

// État vide de la section Objectifs : trois emplacements à remplir, un par slot.
// Les slots sont figés (SPEC §3) — c'est bien « le premier / deuxième /
// troisième emplacement », pas une liste qui se décale.
//
// Ici, et ici seulement, les invitations SONT le contenu de l'écran : il n'y a
// rien d'autre à montrer. Dès qu'un objectif existe, elles se réduisent à
// `ObjectiveSlotInvite` — sinon une place vide se lirait comme un manque.
const PROMPTS = [
  {
    title: 'Votre premier objectif',
    body: 'Sur l’année ou sur un trimestre — c’est vous qui voyez.',
  },
  {
    title: 'Votre deuxième objectif',
    body: 'Trois maximum à la fois : c’est ce qui garde le cap lisible.',
  },
  {
    title: 'Votre troisième objectif',
    body: 'Un trimestriel libère sa place au trimestre suivant.',
  },
]

export function ObjectiveSlotsEmpty() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {PRINCIPAL_SLOTS.map((slot, i) => (
        <Link
          key={slot}
          to="/objectifs"
          className="flex min-h-[172px] flex-col items-center justify-center gap-2.5 rounded-[18px] border-[1.5px] border-dashed border-border-strong bg-surface-sidebar px-4.5 py-5.5 text-center transition-[border-color,background-color,transform] duration-150 hover:-translate-y-0.5 hover:border-border-primary-soft hover:bg-primary-tint focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none active:translate-y-0"
        >
          <span
            className="flex size-9.5 items-center justify-center rounded-lg text-[19px] text-white opacity-90"
            style={{ backgroundColor: objectiveSkin(slot).core }}
            aria-hidden="true"
          >
            +
          </span>
          <span className="text-[13px] font-semibold text-ink-2">{PROMPTS[i]!.title}</span>
          <span className="max-w-[190px] text-[11px] leading-relaxed text-ink-muted">
            {PROMPTS[i]!.body}
          </span>
          <span className="text-[11px] font-semibold text-primary">Créer cet objectif →</span>
        </Link>
      ))}
    </div>
  )
}
