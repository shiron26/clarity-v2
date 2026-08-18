// Dans un module à part et non dans `ObjectiveRhythmBand.tsx` : un fichier de
// composant ne doit exporter que des composants, sinon le fast refresh perd le
// fil (même raison que `buttonClasses.ts`).
import type { RhythmStat } from './components/ObjectiveRhythmBand'
import type { PeriodUnit } from '../../hooks/useObjectivePeriods'

/**
 * Le chiffre de régularité, tel que les deux bandes de rythme (habitude et
 * quantité) l'affichent — même wording, même garde, même couleur.
 *
 * `percent === null` (aucune période close) n'écrit pas « 0 % » : rien n'a
 * encore été mesuré, et le zéro se lirait comme un échec.
 */
export function regularityStat(
  percent: number | null,
  unit: PeriodUnit,
  color: string,
): RhythmStat {
  return {
    value: percent === null ? '—' : `${percent} %`,
    label: unit === 'month' ? '4 derniers mois' : '4 dernières semaines',
    color: percent === null ? undefined : color,
  }
}
