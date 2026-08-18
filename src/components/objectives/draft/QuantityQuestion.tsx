import { useId, useState, type ReactNode } from 'react'
import { OptionCard, OptionCardGroup } from '../../ui/OptionCard'
import { WeekIcon } from '../../icons/WeekIcon'
import { MonthIcon } from '../../icons/MonthIcon'
import { PlusIcon } from '../../icons/PlusIcon'
import { SwapIcon } from '../../icons/SwapIcon'
import { UnitField } from '../../ui/UnitField'
import { FieldLabel } from '../../ui/FieldLabel'
import { CustomUnitInput, UnitSelect } from './UnitSelect'
import { FeasibilityNote, NoteAside, QuietNote } from './FeasibilityNote'
import { quantityEffort } from '../../../lib/objectiveFeasibility'
import { formatQuantity } from '../../../lib/objectiveWording'
import {
  isCustomUnit,
  parseAmount,
  type EntryMode,
  type ObjectiveDraft,
} from '../../../lib/objectiveDraft'
import type { PeriodUnit } from '../../../hooks/useObjectivePeriods'
import type { IsoDate } from '../../../lib/appDate'

/**
 * « Quelle cible ? »
 *
 * Le **mode de saisie est le réglage qui compte** : un relevé remplace la valeur
 * précédente et peut baisser (le solde d'un compte, un poids), un cumul
 * s'additionne (des livres, des kilomètres). Forcer une épargne en cumul
 * obligerait à faire la soustraction de tête chaque mois — et les gens
 * arrêteraient de saisir.
 *
 * D'où le critère mis en avant dans les deux descriptions : **est-ce que la
 * valeur peut baisser ?** Il n'existe pas de saisie négative en cumul, donc tout
 * ce qui régresse — un poids qui remonte, une épargne dans laquelle on pioche —
 * relève du relevé. Nommer le mécanisme (« la valeur remplace la précédente »)
 * décrivait ce que fait l'application ; nommer le sens de variation dit à
 * l'utilisateur laquelle des deux cartes est la sienne.
 *
 * **Il est posé en premier, et ce n'était pas le cas.** L'écran demandait la
 * cible, puis le mode, puis — seulement en relevé — le point de départ : un
 * champ qui apparaissait au milieu du formulaire selon une réponse donnée juste
 * au-dessus, et qui déplaçait tout ce qui suivait. Le mode donne leur sens aux
 * chiffres, il vient donc avant eux ; plus rien ne bouge ensuite, seule la
 * cellule « Aujourd'hui » existe ou non.
 *
 * Le point de départ n'existe qu'en mode relevé : en cumul, on part de zéro par
 * définition. Il devient le premier relevé de l'objectif.
 *
 * **Le sens de la cible ne se demande pas, il se lit.** Un point de départ
 * au-dessus de la cible (78 kg vers 70) est une cible à la baisse ; en dessous,
 * une cible à la hausse. Poser la question en plus aurait ajouté un choix là où
 * les deux nombres viennent d'être saisis côte à côte et le disent déjà. C'est
 * pour cela que « Aujourd'hui » est obligatoire : il porte le sens autant que la
 * valeur, et un départ manquant ferait lire une perte de poids comme une prise.
 */
const MODES: ReadonlyArray<{
  value: EntryMode
  title: string
  description: string
  icon: ReactNode
}> = [
  {
    value: 'releve',
    title: 'Je note un total',
    description: 'Un solde, un poids : la valeur peut monter comme baisser.',
    icon: <SwapIcon className="size-5" />,
  },
  {
    value: 'cumul',
    title: 'J’incrémente',
    description: 'Des kilomètres, des pages : le total ne fait que monter.',
    icon: <PlusIcon className="size-5" />,
  },
]

const FREQUENCIES: ReadonlyArray<{
  value: PeriodUnit
  label: string
  description: string
  icon: ReactNode
}> = [
  {
    value: 'week',
    label: 'Chaque semaine',
    description: 'Une progression plus fine.',
    icon: <WeekIcon className="size-5" />,
  },
  {
    value: 'month',
    label: 'Chaque mois',
    description: 'Une seule saisie par mois.',
    icon: <MonthIcon className="size-5" />,
  },
]

type QuantityQuestionProps = {
  draft: ObjectiveDraft
  onChange: (patch: Partial<ObjectiveDraft>) => void
  today: IsoDate
  year: number
}

export function QuantityQuestion({ draft, onChange, today, year }: QuantityQuestionProps) {
  const startId = useId()
  const targetId = useId()
  const [custom, setCustom] = useState(() => isCustomUnit(draft.unit))

  const releve = draft.entryMode === 'releve'
  const target = parseAmount(draft.targetValue)
  // Le point de départ est requis en relevé : tant qu'il manque, il n'y a pas
  // d'effort à projeter, seulement une phrase à dire.
  const startMissing = releve && parseAmount(draft.startValue) === null
  const start = releve ? (parseAmount(draft.startValue) ?? 0) : 0
  const effort = quantityEffort({
    today,
    year,
    quarter: draft.quarter,
    unit: draft.periodUnit,
    target: target ?? 0,
    start,
  })
  const rhythm = draft.periodUnit === 'week' ? 'par semaine' : 'par mois'
  // Le suffixe des champs de valeur : pendant la saisie d'une unité libre, il
  // n'y a rien à suffixer.
  const suffix = custom ? '' : draft.unit

  return (
    <>
      <FieldLabel>Comment vous le noterez</FieldLabel>
      <OptionCardGroup label="Mode de saisie" columns={2}>
        {MODES.map((mode) => (
          <OptionCard
            key={mode.value}
            selected={draft.entryMode === mode.value}
            onSelect={() => onChange({ entryMode: mode.value })}
            icon={mode.icon}
            title={mode.title}
            description={mode.description}
          />
        ))}
      </OptionCardGroup>

      {/* L'unité gouverne les deux champs de valeur : elle est posée une fois,
          sur la ligne de titre du bloc. À côté d'un champ, comme avant, elle ne
          laissait pas la place à un second — un select se dimensionne sur son
          option la plus longue, ici « Sans unité ». */}
      <div className="mt-5.5">
        <div className="mb-[7px] flex items-center justify-between gap-3">
          <FieldLabel className="mb-0">Votre cible</FieldLabel>
          <UnitSelect
            unit={draft.unit}
            onChange={(unit) => onChange({ unit })}
            custom={custom}
            onCustomChange={setCustom}
            wrapperClassName="shrink-0"
          />
        </div>

        {custom && (
          <CustomUnitInput
            unit={draft.unit}
            onChange={(unit) => onChange({ unit })}
            className="mb-2.5"
          />
        )}

        <div className={releve ? 'grid gap-2.5 sm:grid-cols-2' : undefined}>
          {releve && (
            <div>
              <FieldLabel htmlFor={startId}>Aujourd’hui</FieldLabel>
              <UnitField
                id={startId}
                value={draft.startValue}
                onChange={(startValue) => onChange({ startValue })}
                unit={suffix}
                placeholder="0"
                ariaLabel="Valeur d’aujourd’hui"
              />
            </div>
          )}
          <div>
            <FieldLabel htmlFor={targetId}>À atteindre</FieldLabel>
            <UnitField
              id={targetId}
              value={draft.targetValue}
              onChange={(targetValue) => onChange({ targetValue })}
              unit={suffix}
              placeholder="6 000"
              ariaLabel="Valeur à atteindre"
            />
          </div>
        </div>
      </div>

      <div className="mt-5.5">
        <FieldLabel>À quelle fréquence ?</FieldLabel>
        <OptionCardGroup label="Fréquence des relevés" columns={2}>
          {FREQUENCIES.map((frequency) => (
            <OptionCard
              key={frequency.value}
              selected={draft.periodUnit === frequency.value}
              onSelect={() => onChange({ periodUnit: frequency.value })}
              icon={frequency.icon}
              title={frequency.label}
              description={frequency.description}
            />
          ))}
        </OptionCardGroup>
      </div>

      {/* Rien tant qu'aucune cible n'est saisie : sans elle, l'encart annonçait
          « votre point de départ atteint déjà la cible » (0 ≥ 0) dès l'ouverture
          de l'écran, soit un avertissement faux sur un formulaire vide.

          « de moins » quand la cible est sous le point de départ : c'est le seul
          endroit du parcours où le sens déduit se donne à relire, et « soit
          1,6 kg par mois » sur une perte de poids se lirait à l'envers. */}
      {/* Le bouton de l'étape est déjà désactivé, mais un bouton éteint ne dit
          pas ce qui manque : c'est l'encart qui le dit, à la place exacte où
          l'effort s'afficherait une fois le champ rempli. */}
      {startMissing && (
        <QuietNote>
          Indiquez où vous en êtes aujourd’hui : c’est le point de départ de votre
          progression.
        </QuietNote>
      )}

      {!startMissing && target !== null && target > 0 && (
        <FeasibilityNote>
          {effort.remaining <= 0 ? (
            <>
              Votre point de départ est déjà votre cible.{' '}
              <NoteAside>Visez ailleurs.</NoteAside>
            </>
          ) : effort.perEntry === null ? (
            'Il ne reste aucun relevé d’ici la fin de la fenêtre.'
          ) : (
            <>
              Il reste{' '}
              <b>
                {effort.entriesLeft} relevé{effort.entriesLeft > 1 ? 's' : ''}
              </b>
              , soit{' '}
              <b>
                {formatQuantity(effort.perEntry, suffix)}
                {effort.descending ? ' de moins ' : ' '}
                {rhythm}
              </b>
              .
            </>
          )}
        </FeasibilityNote>
      )}
    </>
  )
}
