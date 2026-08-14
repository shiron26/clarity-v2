// Identité visuelle d'un objectif principal, dérivée de son `slot`.
//
// Le slot est un emplacement FIGÉ attribué à la création (SPEC §3) : supprimer
// un objectif libère son slot sans décaler les autres. La couleur suit donc le
// slot, jamais l'ordre d'affichage — sinon les cartes changeraient de couleur
// dès qu'un objectif disparaît.

export type ObjectiveSkin = {
  /** Fond de la carte. */
  gradient: string
  /** Couleur pleine du disque au centre de l'anneau. */
  core: string
  /** Pastille de légende dans l'activité trimestrielle. */
  hue: string
  /** Rampe de la heatmap : plus la série dure, plus c'est chaud. */
  ramp: [string, string, string, string, string, string]
  /** Ombre portée de la carte. */
  shadow: string
}

const SKINS: Record<number, ObjectiveSkin> = {
  1: {
    gradient: 'linear-gradient(150deg,#1420ff 0%,#0f62ff 48%,#00c2ff 100%)',
    core: '#0f55ff',
    hue: '#00a3ff',
    ramp: ['#2f7bff', '#00a3ff', '#00c6ff', '#22dcff', '#5ceaff', '#9df4ff'],
    shadow: '0 12px 30px rgb(15 98 255 / 0.32)',
  },
  2: {
    gradient: 'linear-gradient(150deg,#5b00f5 0%,#8318ff 55%,#c44dff 100%)',
    core: '#7d0fff',
    hue: '#b44dff',
    ramp: ['#a02bff', '#b44dff', '#c76aff', '#d98aff', '#e9adff', '#f6d2ff'],
    shadow: '0 12px 30px rgb(131 24 255 / 0.32)',
  },
  3: {
    gradient: 'linear-gradient(150deg,#009e54 0%,#00c46a 52%,#2aeb8d 100%)',
    core: '#00b862',
    hue: '#0fe888',
    ramp: ['#00d474', '#0fe888', '#3ff5a2', '#6ffbba', '#9dffcf', '#ccffe6'],
    shadow: '0 12px 30px rgb(0 196 106 / 0.3)',
  },
}

export function objectiveSkin(slot: number | null): ObjectiveSkin {
  return SKINS[slot ?? 1] ?? SKINS[1]!
}

/** Les trois emplacements d'objectif principal (SPEC §3 : 1 à 3, jamais plus). */
export const PRINCIPAL_SLOTS = [1, 2, 3] as const

/**
 * Masquage du mode confidentialité : on garde une longueur plausible pour ne pas
 * casser la mise en page, sans laisser deviner le titre.
 */
export function maskTitle(title: string): string {
  return '•'.repeat(Math.min(14, Math.max(6, Math.round(title.length * 0.6))))
}
