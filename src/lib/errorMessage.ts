// Traduction des erreurs serveur en copie affichable.
//
// Règle : un message de la base ne sort JAMAIS à l'écran. `error.message` est en
// anglais, porte du jargon PostgREST (« JWT issued at future ») et change sans
// préavis. Le détail technique part en console — voir le `QueryCache.onError`
// de src/lib/queryClient.ts pour les queries, et les `console.error` explicites
// des pages auth, qui sont hors TanStack Query.
//
// Le produit vouvoie (cf. « VOS OBJECTIFS », « Votre premier objectif »).
import { classifyError, errorCode, errorMessageText } from './queryError'

const OFFLINE = 'Connexion au serveur impossible. Vérifiez votre connexion, puis réessayez.'

// Les règles métier des triggers lèvent des exceptions PL/pgSQL sans errcode :
// elles arrivent toutes en P0001, seule la chaîne les distingue. Certaines
// portent un suffixe « : détail », d'où la comparaison sur le préfixe.
const BUSINESS_RULES: Array<[string, string]> = [
  // « Sur cette période » et non « cette année » : un slot se libère à la fin
  // de la fenêtre de l'objectif qui l'occupe, pas au 31 décembre.
  ['slot_full', 'Tous les emplacements sont pris sur cette période : trois objectifs principaux, cinq secondaires.'],
  ['milestone_cap', 'Quatre jalons maximum par trimestre.'],
  ['objective_year_archived', 'Cette année est archivée : elle ne peut plus être modifiée.'],
  ['objective_archived_read_only', 'Cette année est archivée : elle ne peut plus être modifiée.'],
  ['milestone_archived_read_only', 'Cette année est archivée : elle ne peut plus être modifiée.'],
  ['objective_identity_immutable', 'La nature, la période et la façon de mesurer un objectif ne changent plus après sa création.'],
  ['milestone_quarter_immutable', 'Un jalon ne se déplace pas d’un trimestre à l’autre — réécrivez-le ailleurs.'],
  ['objective_write_not_allowed', 'Vous n’avez pas accès à cet objectif.'],
  // Saisies d'un objectif quantifié.
  ['objective_entry_not_quantified', 'Cet objectif ne se mesure pas en valeurs — il n’attend pas de relevé.'],
  ['objective_entry_identity_immutable', 'Un relevé ne change pas de date : corrigez sa valeur, ou effacez-le.'],
  ['objective_entry_objective_not_found', 'Cet objectif n’existe plus.'],
  // Séances réparées depuis le rituel (REFONTE §7). `day` est la seule date que
  // le client choisisse : ces quatre règles sont ce qui la borne, et l'écran 2
  // désactive déjà les cases correspondantes — la copie sert de filet.
  ['objective_session_not_habit', 'Cet objectif ne se compte pas en séances.'],
  ['objective_session_future', 'On n’enregistre pas une séance qui n’a pas encore eu lieu.'],
  ['objective_session_out_of_window', 'Ce jour est en dehors de la période de cet objectif.'],
  ['objective_session_closed', 'Cet objectif est arrêté : son passé ne se modifie plus.'],
  ['objective_session_objective_not_found', 'Cet objectif n’existe plus.'],
  ['milestone_write_not_allowed', 'Vous n’avez pas accès à cet objectif.'],
  // Tâches et listes. Le vocabulaire produit ne dit jamais « fork » : une
  // déclinaison personnelle d'un objectif d'espace est un « objectif repris ».
  ['task_write_not_allowed', 'Vous n’avez pas accès à cette tâche.'],
  ['task_owner_immutable', 'Une tâche ne change pas de propriétaire — recréez-la à l’endroit voulu.'],
  ['task_assignee_not_member', 'Cette personne ne fait plus partie de l’espace.'],
  ['task_list_not_found', 'Cette liste n’existe plus.'],
  ['task_list_owner_mismatch', 'Cette liste n’appartient pas au même espace que la tâche.'],
  ['task_objective_not_found', 'Cet objectif n’existe plus.'],
  [
    'task_objective_invalid_target',
    'Une tâche se relie à un objectif principal ou à un objectif repris — jamais à un secondaire.',
  ],
  ['task_objective_owner_mismatch', 'Cet objectif ne vous appartient pas.'],
  // Récurrences. La première n'est pas un accident de saisie : elle dit ce qu'on
  // ne peut pas faire ET comment le contourner, sans quoi elle se lirait comme
  // une panne.
  [
    'task_recurrence_future',
    'Cette tâche se répète : elle ne se coche pas avant son échéance. Changez sa date si vous l’avez faite en avance.',
  ],
  ['task_not_recurring', 'Cette tâche ne se répète pas : il n’y a pas de prochaine fois.'],
  ['task_already_completed', 'Cette tâche est déjà cochée.'],
  [
    'task_recurrence_unknown',
    'La répétition de cette tâche n’est plus lisible : choisissez-en une nouvelle dans la tâche.',
  ],
  [
    'task_objective_space_requires_fork',
    'Reprenez d’abord cet objectif pour vous : une tâche partagée ne se relie qu’à votre reprise.',
  ],
  [
    'task_objective_fork_owner_only',
    'Vous ne pouvez relier une tâche qu’à votre propre reprise de l’objectif.',
  ],
  ['task_objective_fork_space_mismatch', 'Cet objectif appartient à un autre espace.'],
  ['list_write_not_allowed', 'Vous n’avez pas accès à cette liste.'],
  ['list_owner_immutable', 'Une liste ne change pas de propriétaire.'],
  // Les trois aide-mémoire sont posés par le serveur à l'inscription. Ces règles
  // gardent un invariant que l'interface n'offre pas d'enfreindre : leur copie
  // sert au cas où une version du front dérive.
  ['list_kind_not_allowed', 'Les aide-mémoire sont créés avec votre compte, il n’y en a pas d’autres à ajouter.'],
  ['list_kind_immutable', 'Une liste ordinaire ne devient pas un aide-mémoire, et l’inverse non plus.'],
  ['list_memo_undeletable', 'Un aide-mémoire ne se supprime pas. Videz-le, il redevient vierge.'],
  // Reviews. La plupart de ces règles gardent des invariants que l'interface
  // n'offre pas d'enfreindre : leur copie sert au cas où une version du front
  // dérive, jamais au parcours nominal.
  ['review_item_comment_too_long', 'Votre note ne peut pas dépasser 280 caractères.'],
  ['review_item_scope_personal', 'Cet objectif ne se note pas dans votre review personnelle.'],
  ['review_item_scope_space', 'Dans un espace, chacun ne note que ses propres objectifs repris.'],
  ['review_item_not_member', 'Vous ne faites plus partie de cet espace.'],
  ['review_item_fork_space_mismatch', 'Cet objectif appartient à un autre espace.'],
  // Depuis REFONTE §8, le verdict existe aussi au trimestre : la règle ne vaut
  // plus que pour la semaine, et sa copie ne peut plus dire « annuel ».
  ['review_item_achieved_year_only', 'Le verdict « atteint » ne se pose pas sur une semaine.'],
  ['review_item_rating_not_for_year', 'Le bilan annuel se conclut par un verdict, pas par une note.'],
  ['review_item_verdict_exclusive', 'Un objectif se note, ou reçoit un verdict — pas les deux.'],
  ['review_item_review_not_found', 'Cette review n’existe plus.'],
  ['review_item_objective_not_found', 'Cet objectif n’existe plus.'],
  ['review_item_identity_immutable', 'Une note ne change ni de review ni d’objectif.'],
  ['review_item_delete_not_allowed', 'Vous ne pouvez pas effacer cette note.'],
  ['review_identity_immutable', 'La période d’une review ne peut plus changer.'],
  ['review_validate_creator_only', 'Seule la personne qui a lancé la session peut la valider.'],
  ['review_cursor_not_visible', 'Cet objectif n’est pas visible dans cette review.'],
]

/** Copie métier si l'erreur correspond à une règle serveur connue, sinon null. */
function businessRuleMessage(error: unknown): string | null {
  const raw = errorMessageText(error)
  if (!raw) return null
  const name = raw.split(':')[0]!.trim()
  return BUSINESS_RULES.find(([rule]) => rule === name)?.[1] ?? null
}

/** Copie pour un échec de lecture ou d'écriture de données. */
export function dataErrorMessage(error: unknown): string {
  // Une règle métier prime sur le classement générique : elle dit précisément
  // ce qui bloque, là où `unknown` ne dirait que « erreur de notre côté ».
  const rule = businessRuleMessage(error)
  if (rule) return rule

  switch (classifyError(error)) {
    case 'authTransient':
      // PGRST301 recouvre deux situations que PostgREST ne distingue pas
      // (token trop récent pour l'horloge du vérifieur, token expiré) : la
      // copie doit rester vraie dans les deux cas. L'utilisateur ne l'atteint
      // qu'après épuisement des tentatives — le cas nominal (~1 s) est absorbé
      // par le retry et reste invisible.
      return 'Votre session n’a pas pu être validée. Réessayez dans un instant.'
    case 'authGone':
      return 'Votre session a expiré. Reconnectez-vous pour continuer.'
    case 'offline':
      return OFFLINE
    case 'permission':
      return 'Vous n’avez pas accès à ces données.'
    case 'notFound':
      return 'Cette donnée n’existe plus.'
    case 'conflict':
      return 'Cette modification entre en conflit avec une donnée existante.'
    case 'businessRule':
    // Une règle de trigger qu'on n'a pas traduite plus haut : la copie manque
    // dans `BUSINESS_RULES`. C'est un trou de notre côté, pas une panne, et la
    // phrase générique est ce qu'on a de moins faux à dire en attendant.
    case 'unknown':
      return 'Une erreur est survenue de notre côté. Réessayez dans un instant.'
  }
}

/** Copie pour un échec de connexion ou d'inscription (codes GoTrue). */
export function authErrorMessage(error: unknown): string {
  switch (errorCode(error)) {
    case 'invalid_credentials':
      return 'Email ou mot de passe incorrect.'
    case 'email_not_confirmed':
      return 'Votre email n’est pas encore confirmé — vérifiez votre boîte mail.'
    case 'weak_password':
      return 'Mot de passe trop faible.'
    case 'validation_failed':
      return 'Vérifiez les informations saisies.'
    case 'signup_disabled':
      return 'Les inscriptions sont fermées pour le moment.'
    case 'user_banned':
      return 'Ce compte est suspendu.'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Trop de tentatives. Patientez quelques minutes avant de réessayer.'
  }

  // `email_exists` / `user_already_exists` ne sont volontairement pas mappés :
  // l'inscription ne doit pas révéler l'existence d'un compte (AGENTS.md).
  if (classifyError(error) === 'offline') return OFFLINE

  return 'Connexion impossible pour le moment. Réessayez dans un instant.'
}
