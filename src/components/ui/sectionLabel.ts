// Le sur-titre d'une section — « LES QUATRE TRIMESTRES », « SEMAINES DU
// TRIMESTRE », « VOS OBJECTIFS ».
//
// Il existait en trois tailles selon l'écran (9 px, 11 px, chasse de 1,2 à
// 1,5 px) et toujours en `ink-muted`, le gris le plus clair du texte : à cette
// taille et ce contraste, il se lisait comme une mention légale plutôt que comme
// le titre de ce qu'on regarde. Une seule définition, un cran plus grand et un
// gris plus franc.
//
// La couleur fait partie de la constante mais reste surchargeable : les bandes
// posées sur fond nuit passent en `text-ink-onnight`, tailwind-merge laissant
// gagner la classe la plus tardive.

export const SECTION_LABEL = 'text-label font-semibold tracking-[1.1px] text-ink-3 uppercase'
