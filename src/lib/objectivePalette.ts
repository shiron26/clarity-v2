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
  /**
   * Rampe de la heatmap : **la couleur de l'objectif, du sourd au plein**, selon
   * la part de la semaine tenue.
   *
   * Elle allait auparavant du `core` vers un pastel qui n'était plus la couleur
   * de personne — le bleu virait au cyan blanchi, le violet au rose, le vert au
   * menthe. Sur fond sombre, ces teintes claires se lisaient de surcroît à
   * l'envers : plus on en avait fait, plus la case était délavée. Chaque niveau
   * est donc un mélange du `core` et du fond de nuit, du plus dilué (45 %) au
   * `core` pur — une semaine bien tenue est la plus franche, et on reconnaît
   * l'objectif à sa couleur sans lire son titre.
   */
  ramp: [string, string, string, string, string, string]
  /** Ombre portée de la carte. */
  shadow: string
}

const SKINS: Record<number, ObjectiveSkin> = {
  1: {
    gradient: 'linear-gradient(150deg,#1420ff 0%,#0f62ff 48%,#00c2ff 100%)',
    core: '#0f55ff',
    hue: '#00a3ff',
    ramp: ['#153587', '#143b9f', '#1342b7', '#1148cf', '#104fe7', '#0f55ff'],
    shadow: '0 12px 30px rgb(15 98 255 / 0.32)',
  },
  2: {
    gradient: 'linear-gradient(150deg,#5b00f5 0%,#8318ff 55%,#c44dff 100%)',
    core: '#7d0fff',
    hue: '#b44dff',
    ramp: ['#471687', '#51149f', '#5c13b7', '#6712cf', '#7210e7', '#7d0fff'],
    shadow: '0 12px 30px rgb(131 24 255 / 0.32)',
  },
  3: {
    gradient: 'linear-gradient(150deg,#009e54 0%,#00c46a 52%,#2aeb8d 100%)',
    core: '#00b862',
    hue: '#0fe888',
    ramp: ['#0e6240', '#0b7347', '#09844e', '#069554', '#03a75b', '#00b862'],
    shadow: '0 12px 30px rgb(0 196 106 / 0.3)',
  },
}

/**
 * Les secondaires n'ont **pas d'identité propre** : un gris partagé, le même
 * pour tous. C'est le signal « discret » le plus fort du produit — on ne retient
 * pas leur couleur parce qu'on n'est pas censé les surveiller (REFONTE §4).
 */
export const SECONDARY_SKIN: ObjectiveSkin = {
  gradient: 'linear-gradient(150deg,#3f414d,#5a5c6b)',
  core: '#5a5c6b',
  hue: '#8b8e9e',
  ramp: ['#373844', '#3e3f4c', '#454754', '#4c4e5b', '#535563', '#5a5c6b'],
  shadow: '0 8px 20px rgb(63 65 77 / 0.22)',
}

export function objectiveSkin(slot: number | null): ObjectiveSkin {
  return SKINS[slot ?? 1] ?? SKINS[1]!
}

/**
 * Le skin d'un objectif : sa couleur de slot s'il est principal, le gris
 * partagé s'il est secondaire.
 *
 * À préférer à `objectiveSkin(slot)` partout où un secondaire peut passer — un
 * secondaire porte un `slot`, et le lire directement lui donnerait la couleur
 * d'un principal.
 */
export function objectiveSkinOf(objective: { kind: string | null; slot: number | null }): ObjectiveSkin {
  return objective.kind === 'secondaire' ? SECONDARY_SKIN : objectiveSkin(objective.slot)
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
