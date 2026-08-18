// Les titres et sous-titres des questions de création d'un objectif.
//
// Deux écrans posent exactement les mêmes questions : le parcours d'onboarding
// (REFONTE §2) et l'assistant de l'écran Objectifs (§4). La première version de
// cet assistant avait redit ces textes autrement ; deux copies pour une même
// question, c'est la garantie qu'elles divergeront — et elles avaient déjà
// commencé.
//
// Dans `src/components/` parce que deux features la consomment et qu'une feature
// n'importe jamais d'une autre (AGENTS.md). Même emplacement, même raison que
// `objectiveDraft.ts` dans `src/lib/`.
//
// **Ce fichier ne porte que ce que rend la COQUILLE** — titre, sous-titre. Les
// libellés d'options vivent dans le corps de leur question : ce corps étant
// lui-même unique, sa copie l'est aussi, et plusieurs portent du JSX (`<b>`) que
// ce fichier ne doit pas connaître. Rester en `.ts` est le test qui le dit.
//
// **La ponctuation compte** : apostrophes typographiques `’` et guillemets
// français `« »`. Les recopier telles quelles.

export type QuestionCopy = { title: string; subtitle: string }

/**
 * Les questions communes aux deux parcours, plus `nature`, que seul l'assistant
 * pose — l'onboarding crée le premier objectif, qui est un principal par
 * définition.
 */
export const DRAFT_COPY = {
  nature: {
    title: 'Quelle place doit-il prendre ?',
    subtitle:
      'L’un vous demande un rythme chaque semaine, l’autre attend le bilan du trimestre.',
  },
  goal: {
    title: 'Qu’est-ce que vous voulez accomplir ?',
    subtitle: 'Quatre questions pour le poser. Une minute, pas plus.',
  },
  horizon: {
    title: 'Sur combien de temps ?',
    subtitle:
      'Le temps que vous vous donnez pour l’atteindre. Un objectif ne dépasse pas le 31 décembre.',
  },
  measure: {
    title: 'Comment comptez-vous avancer dessus ?',
    subtitle:
      'Votre réponse fixe ce que l’application vous demandera ensuite : un rythme, un relevé de temps en temps, ou rien du tout.',
  },
  habit: {
    title: 'À quel rythme ?',
    subtitle: 'Combien de fois par semaine, ou par mois. Vous pourrez le changer à tout moment.',
  },
  quantity: {
    title: 'Quelle cible ?',
    subtitle: 'Le chiffre à atteindre, et comment vous le noterez.',
  },
  milestones: {
    title: 'Quelles sont les étapes ?',
    subtitle: 'Les étapes qui comptent, dans l’ordre où vous les franchirez.',
  },
} as const satisfies Record<string, QuestionCopy>

/**
 * Le tout premier écran du parcours de bienvenue remplace le sous-titre de
 * `goal`. Seule exception à la règle « une question, une copie », et elle est
 * motivée : à la première ouverture, personne ne sait encore à quoi sert
 * l'application ni ce qu'elle fera de la réponse. Poser la question sans dire
 * où l'on va, c'est laisser l'utilisateur deviner. L'assistant de l'écran
 * Objectifs, lui, n'a plus rien à présenter.
 *
 * La phrase dit les deux choses qui manquaient : ce que l'application tient
 * (trois objectifs, pas plus) et que les suivants se créent tout de suite — pas
 * « quand celui-ci tournera », puisque le parcours propose d'en poser trois.
 */
export const ONBOARDING_GOAL_SUBTITLE =
  'Quatre questions pour poser votre premier objectif. Clarity en suit trois au maximum, vous ajouterez les autres juste après.'
