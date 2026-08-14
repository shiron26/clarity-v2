// Chronométrage de la séquence « tâche cochée » (maquette Clarity Redesign v2) :
// la ligne flashe, se replie, puis quitte la liste. Les deux écrans qui affichent
// des tâches (dashboard, écran Tâches) doivent jouer exactement la même chose —
// d'où les constantes ici plutôt que dans l'un des deux.

/** 1 = flash, 2 = repli. */
export type DonePhase = 1 | 2

/** Bascule du flash vers le repli. */
export const DONE_FLASH_MS = 680

/** Fin de la séquence : la ligne sort de la liste. */
export const DONE_CLEAR_MS = 1000
