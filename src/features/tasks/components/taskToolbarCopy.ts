// Les infobulles de la barre d'outils des modales de tâche.
//
// Écrites une fois : la création et l'édition posent la MÊME barre, et deux
// copies divergent (même raison que `taskDeleteCopy.ts` et que le `copy.ts` des
// questions d'objectif).
//
// Chacune dit une règle qu'aucun libellé ne porte à l'écran : c'est ce qui
// justifie l'infobulle. Le nom seul répéterait ce qu'on lit déjà.

export const IMPORTANT_TOOLTIP = {
  title: 'Important',
  // L'effet est invisible tant qu'on n'a pas changé de tri : sans cette phrase,
  // le drapeau passe pour une décoration.
  hint: 'Un drapeau sur la tâche. Elle passe en tête quand vous triez par priorité.',
} as const

export const RECURRENCE_TOOLTIP = {
  // Le segment affiche sa VALEUR (« Aucune », « Chaque semaine »), jamais son
  // rôle : l'infobulle est le seul endroit qui le nomme.
  title: 'Répétition',
  // La règle qui surprend tout le monde : rien n'est programmé d'avance.
  hint: 'La tâche revient à la date suivante, une fois que vous avez coché celle-ci.',
} as const
