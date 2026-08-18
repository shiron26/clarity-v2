// Le brouillon d'un objectif en cours de saisie, et LA définition de ce qui en
// fait un brouillon valide.
//
// Deux écrans produisent des objectifs — le parcours d'onboarding (REFONTE §2)
// et l'assistant de création (§4). Dupliquer « quelle mesure autorise quoi » dans
// les deux, c'est se garantir qu'ils divergeront. Ce module vit donc dans
// `src/lib/` : une feature n'importe jamais d'une autre (AGENTS.md), et ce qui
// est partagé remonte. Même emplacement, même raison que `reviewRating.ts`.
//
// Les règles ci-dessous sont la copie fidèle des contraintes SQL
// `objective_measure_shape` et `objective_measure_kind` (migration 0017). Elles
// ne remplacent pas la base — elles évitent d'aller y chercher un
// `check_violation`, que l'utilisateur lirait « une erreur est survenue de notre
// côté ».
import type { ObjectiveMeasure } from '../hooks/useObjectives'
import type { ObjectiveKind, NewObjective } from '../hooks/useObjectiveMutations'
import type { PeriodUnit } from '../hooks/useObjectivePeriods'

export type EntryMode = 'releve' | 'cumul'

export type ObjectiveDraft = {
  kind: ObjectiveKind
  title: string
  label: string
  /** Le pourquoi et la description : facultatifs, jamais demandés par l'onboarding. */
  why: string | null
  description: string | null
  /** `null` = objectif annuel ; 1–4 pour un trimestre. */
  quarter: number | null
  measure: ObjectiveMeasure
  /** Unité de cadence (habitude) ou de relevé (quantité) ; nulle sur les jalons. */
  periodUnit: PeriodUnit
  /** Habitude seulement. */
  cadence: number
  /** Cible totale : facultative sur une habitude, obligatoire sur une quantité. */
  targetValue: string
  /** Libellé d'affichage. Chaîne vide = sans unité. */
  unit: string
  /** Quantité seulement. */
  entryMode: EntryMode
  /** Quantité en mode relevé : la valeur d'aujourd'hui, posée en premier relevé. */
  startValue: string
  /** Jalons seulement — quatre lignes fixes, les vides sont ignorées. */
  milestones: string[]
}

/** Le cap serveur (`milestone_cap`), énoncé plutôt que découvert à l'erreur. */
export const MAX_MILESTONES = 4

/** Cadence maximale quand la période est la semaine (une séance par jour). */
export const MAX_WEEKLY_CADENCE = 7

/**
 * Longueur maximale d'une unité écrite à la main. Une unité est un **suffixe**,
 * rendu deux fois sur la carte (« 0 candidatures sur 20 candidatures ») : le
 * plafond garde un mot, il refuse la phrase. Il est réglé sur les mots réels que
 * les gens écrivent (« candidatures », « entraînements ») et non sur ce que la
 * carte affiche le plus confortablement : c'est à la carte de tenir, elle replie
 * sa ligne de valeur.
 */
export const MAX_UNIT_LENGTH = 14

/**
 * Douze entrées, à plat. Volontairement pas de « pages », « livres » ni
 * « mots » : l'unité n'est qu'un libellé d'affichage, pas une mesure, et ouvrir
 * une taxonomie du décompte fabriquerait un vocabulaire que le produit n'a pas à
 * tenir — « sans unité » couvre ces cas. Pas de « séances » non plus : c'est
 * « fois ». `OTHER_UNIT` reste la soupape, parce qu'une liste fermée ne peut pas
 * tout prévoir et qu'une saisie libre seule serait pire (chacun écrirait €,
 * euros, EUR).
 */
export const OTHER_UNIT = '__autre'

export const OBJECTIVE_UNITS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '', label: 'Sans unité' },
  { value: '€', label: '€' },
  { value: '$', label: '$' },
  { value: 'kg', label: 'kg' },
  { value: 'lb', label: 'lb' },
  { value: 'km', label: 'km' },
  { value: 'mi', label: 'mi' },
  { value: 'pas', label: 'pas' },
  { value: 'h', label: 'h' },
  { value: 'min', label: 'min' },
  { value: 'fois', label: 'fois' },
  { value: OTHER_UNIT, label: 'Autre…' },
]

/**
 * Une unité hors liste est forcément une unité personnalisée : c'est ce qui
 * décide, à l'ouverture d'un formulaire, si le champ libre « Autre… » doit
 * s'afficher déjà ouvert.
 */
export function isCustomUnit(unit: string): boolean {
  return unit !== '' && !OBJECTIVE_UNITS.some((u) => u.value === unit)
}

/** Les défauts de la maquette : annuel, habitude, 3 fois par semaine. */
export function emptyDraft(kind: ObjectiveKind = 'principal'): ObjectiveDraft {
  return {
    kind,
    title: '',
    label: '',
    why: null,
    description: null,
    quarter: null,
    // Un secondaire n'a pas de demande périodique : il ne peut pas être une
    // habitude (contrainte `objective_measure_kind`). La question ne lui est
    // donc jamais posée, et son défaut n'est pas le même.
    measure: kind === 'principal' ? 'habitude' : 'jalons',
    periodUnit: 'week',
    cadence: 3,
    targetValue: '',
    unit: '',
    entryMode: 'releve',
    startValue: '',
    milestones: Array.from({ length: MAX_MILESTONES }, () => ''),
  }
}

/**
 * Le brouillon après un changement de nature, avec ce que la nature interdit
 * déjà réparé.
 *
 * Un secondaire ne peut pas être une habitude (`objective_measure_kind`) : il
 * n'a pas de cadence, donc rien ne lui est demandé chaque semaine. Plutôt que de
 * laisser un brouillon illégal vivre jusqu'à l'insertion, la mesure retombe sur
 * le défaut de la nouvelle nature.
 *
 * La cadence, elle, n'est pas touchée : `toNewObjective` la met déjà à `null`
 * hors habitude, et la conserver rend le retour à « principal » sans perte.
 */
export function withKind(draft: ObjectiveDraft, kind: ObjectiveKind): ObjectiveDraft {
  if (draft.kind === kind) return draft
  const measure =
    kind === 'secondaire' && draft.measure === 'habitude'
      ? emptyDraft(kind).measure // une seule source pour ce défaut
      : draft.measure
  return { ...draft, kind, measure }
}

/**
 * Un nombre saisi à la main : les espaces (y compris insécables) servent de
 * séparateurs de milliers dans la maquette (« 6 000 »), et la virgule est le
 * séparateur décimal français.
 */
export function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[\s  ]/g, '').replace(',', '.')
  if (cleaned === '') return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

export type DraftErrors = Partial<Record<keyof ObjectiveDraft, string>>

/**
 * Ce qui manque ou ne va pas, champ par champ. Un brouillon est prêt quand
 * l'objet rendu est vide.
 */
function draftErrors(draft: ObjectiveDraft): DraftErrors {
  const errors: DraftErrors = {}

  if (draft.title.trim() === '') errors.title = 'Donnez un titre à votre objectif.'
  if (draft.label.trim() === '') errors.label = 'Un nom court est nécessaire.'

  if (draft.quarter !== null && (draft.quarter < 1 || draft.quarter > 4)) {
    errors.quarter = 'Trimestre invalide.'
  }

  // Un secondaire n'a pas de cadence, donc pas d'habitude — la contrainte se dit
  // dans la question (l'écran ne propose que deux réponses) plutôt que d'arriver
  // en `objective_measure_kind` après coup.
  if (draft.kind === 'secondaire' && draft.measure === 'habitude') {
    errors.measure = 'Un objectif secondaire ne se mesure pas à un rythme.'
  }

  if (draft.measure === 'habitude') {
    if (!Number.isInteger(draft.cadence) || draft.cadence < 1) {
      errors.cadence = 'Choisissez un rythme.'
    } else if (draft.periodUnit === 'week' && draft.cadence > MAX_WEEKLY_CADENCE) {
      errors.cadence = 'Sept fois par semaine au maximum : c’est déjà tous les jours.'
    }
    // La cible totale est facultative : « courir 100 fois » en a une, « méditer
    // tous les jours » n'en a pas. Sans cible, l'objectif se mesure à la
    // régularité seule.
    if (draft.targetValue.trim() !== '' && (parseAmount(draft.targetValue) ?? 0) <= 0) {
      errors.targetValue = 'Indiquez un nombre, ou laissez vide.'
    }
  }

  if (draft.measure === 'quantite') {
    const target = parseAmount(draft.targetValue)
    if (target === null || target <= 0) errors.targetValue = 'Indiquez la valeur à atteindre.'
    if (draft.entryMode === 'releve' && draft.startValue.trim() !== '') {
      if (parseAmount(draft.startValue) === null) {
        errors.startValue = 'Indiquez un nombre, ou laissez vide.'
      }
    }
    // Pas de règle sur la longueur de l'unité : `MAX_UNIT_LENGTH` est un plafond
    // de saisie (`maxLength` du champ libre), pas une condition de validité. En
    // faire une erreur bloquerait l'enregistrement d'un objectif créé avant le
    // plafond, et sans un mot d'explication : aucun écran n'affiche les messages
    // de `draftErrors`, ils ne font que désactiver le bouton.
  }

  if (draft.measure === 'jalons') {
    if (draft.milestones.every((m) => m.trim() === '')) {
      errors.milestones = 'Posez au moins une étape.'
    }
  }

  return errors
}

export function isDraftReady(draft: ObjectiveDraft): boolean {
  return Object.keys(draftErrors(draft)).length === 0
}

/** Les portées de saisie : les cinq écrans de l'assistant, plus l'édition. */
export type DraftScope = 'nature' | 'goal' | 'horizon' | 'measure' | 'setup' | 'edit'

/**
 * Quels champs chaque écran met en jeu.
 *
 * C'est la seule chose que `draftErrors` ne peut pas déduire : elle connaît les
 * règles, pas la mise en scène. Le couple règle / écran vit ici pour qu'ajouter
 * une règle oblige à dire où elle s'affiche — une règle qu'aucun écran ne porte
 * bloquerait un formulaire sans jamais montrer son message.
 *
 * `edit` ne montre ni les étapes (elles se gèrent sur la page de l'objectif, où
 * elles se cochent) ni le point de départ (ce serait un relevé antidaté, que le
 * modèle refuse) : elles ne doivent donc pas bloquer un enregistrement.
 */
const DRAFT_SCOPE_FIELDS: Record<DraftScope, ReadonlyArray<keyof ObjectiveDraft>> = {
  nature: ['kind'],
  goal: ['title', 'label'],
  horizon: ['quarter'],
  measure: ['measure'],
  setup: ['measure', 'cadence', 'targetValue', 'unit', 'startValue', 'milestones'],
  edit: ['title', 'label', 'cadence', 'targetValue', 'unit'],
}

/**
 * Les erreurs de la seule portée demandée. Aucune règle n'est réécrite : c'est
 * une projection du résultat de `draftErrors`.
 */
function draftScopeErrors(draft: ObjectiveDraft, scope: DraftScope): DraftErrors {
  const keep = DRAFT_SCOPE_FIELDS[scope]
  const errors = draftErrors(draft)
  const scoped: DraftErrors = {}
  for (const key of keep) {
    const message = errors[key]
    if (message !== undefined) scoped[key] = message
  }
  return scoped
}

/** Cette portée est-elle complète ? */
export function isScopeReady(draft: ObjectiveDraft, scope: DraftScope): boolean {
  return Object.keys(draftScopeErrors(draft, scope)).length === 0
}

/** Les étapes réellement saisies, dans l'ordre — les lignes vides ne partent pas. */
export function draftMilestones(draft: ObjectiveDraft): string[] {
  return draft.milestones.map((m) => m.trim()).filter((m) => m !== '')
}

/**
 * La conversion unique vers le contrat d'écriture. C'est ici qu'on met à `null`
 * tout ce que la mesure interdit : envoyer une `cadence` sur une quantité, ou un
 * `entry_mode` sur des jalons, ferait échouer `objective_measure_shape` — et
 * l'utilisateur lirait un message générique pour une faute du client.
 */
export function toNewObjective(
  draft: ObjectiveDraft,
  context: { userId: string; year: number },
): NewObjective {
  const habit = draft.measure === 'habitude'
  const quantity = draft.measure === 'quantite'
  const target = parseAmount(draft.targetValue)

  return {
    userId: context.userId,
    year: context.year,
    quarter: draft.quarter,
    kind: draft.kind,
    label: draft.label.trim(),
    title: draft.title.trim(),
    why: draft.why,
    description: draft.description,
    measure: draft.measure,
    // `jalons` n'a pas de période : un objectif par étapes n'a pas de rythme.
    periodUnit: draft.measure === 'jalons' ? null : draft.periodUnit,
    cadence: habit ? draft.cadence : null,
    // Facultative sur une habitude (comptée en séances), requise sur une quantité.
    targetValue: habit || quantity ? target : null,
    // Une habitude se compte en séances, c'est l'application qui compte : pas
    // d'unité à choisir, et surtout pas à stocker.
    unit: quantity && draft.unit !== '' ? draft.unit : null,
    entryMode: quantity ? draft.entryMode : null,
    // `direction` porte les objectifs de seuil (« rester sous »). Le modèle la
    // connaît, aucun écran ne l'expose encore : figée à « atteindre ».
    direction: quantity ? 'atteindre' : null,
  }
}

/**
 * Le brouillon d'un objectif qui existe déjà — l'inverse exact de
 * `toNewObjective`, et à garder à côté d'elle pour qu'un champ ajouté d'un côté
 * se voie manquer de l'autre.
 *
 * Les étapes ne sont pas reprises : elles vivent dans la table `milestone`, ont
 * leur propre cap par trimestre, et se modifient sur la page de l'objectif.
 */
export function draftFromObjective(objective: {
  kind: string | null
  title: string
  label: string
  why: string | null
  description: string | null
  quarter: number | null
  measure: ObjectiveMeasure
  period_unit: PeriodUnit | null
  cadence: number | null
  target_value: number | null
  unit: string | null
  entry_mode: EntryMode | null
}): ObjectiveDraft {
  const base = emptyDraft(objective.kind === 'secondaire' ? 'secondaire' : 'principal')
  return {
    ...base,
    title: objective.title,
    label: objective.label,
    why: objective.why,
    description: objective.description,
    quarter: objective.quarter,
    measure: objective.measure,
    periodUnit: objective.period_unit ?? base.periodUnit,
    cadence: objective.cadence ?? base.cadence,
    targetValue: objective.target_value === null ? '' : String(objective.target_value),
    unit: objective.unit ?? '',
    entryMode: objective.entry_mode ?? base.entryMode,
    startValue: '',
    milestones: base.milestones,
  }
}

