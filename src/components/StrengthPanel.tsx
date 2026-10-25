import { t, useLanguage } from '../i18n/react.ts';
import { useDraft } from '../app/DraftProvider.tsx';
import { strengthModel } from '../app/game.ts';
import { formatNumber, formatStrength } from '../utils/display.ts';
const groupLabels = {
  goalkeeper: 'Torwart',
  defence: 'Abwehr',
  midfield: 'Mittelfeld',
  attack: 'Angriff',
};
export function StrengthPanel() {
  useLanguage();
  const { draft, assessment } = useDraft();
  const values = assessment?.strength;
  const complete = Boolean(draft?.coachCardId && draft.captainPersonId);
  const metrics = [
    {
      key: 'chemistryBonus',
      label: 'Teamchemie',
      cap: strengthModel.caps.chemistry,
      detail: assessment
        ? `${assessment.chemistry.sameNationalityPairs} Länderpaare · ${assessment.chemistry.sameClubPairs} Vereinspaare von ${assessment.chemistry.pairs} Spielerpaaren`
        : 'Gemeinsame Länder und Vereine verbinden deine Elf.',
    },
    {
      key: 'tacticalBonus',
      label: 'Taktik-Fit',
      cap: strengthModel.caps.tactical,
      detail: assessment
        ? `${assessment.tactic.matchingPlayers} von 11 Spielern passen zum Stil „${assessment.tactic.label}“.`
        : 'Die Spielstile deiner Spieler treffen auf deinen Plan.',
    },
    {
      key: 'coachBonus',
      label: 'Coach-Bonus',
      cap: strengthModel.caps.coach,
      detail: assessment?.coach.name
        ? `${assessment.coach.name}: ${assessment.coach.formationMatches ? 'Formation passt' : 'andere bevorzugte Formation'}, ${Math.round(assessment.coach.styleCoverage * 100)} % Stilpassung · Coach-Rating ${Math.round(assessment.coach.ratingFactor * strengthModel.rules.strength.ratingMax)} / ${strengthModel.rules.strength.ratingMax}.`
        : 'Wähle einen Coach mit passender Formation und Spielidee.',
    },
    {
      key: 'captainBonus',
      label: 'Captain-Bonus',
      cap: strengthModel.caps.captain,
      detail: assessment?.captain.name
        ? `${assessment.captain.name} ${assessment.captain.natural ? 'ist ein Natural Captain.' : 'ist kein Natural Captain: kein zusätzlicher Bonus.'}`
        : 'Nur ein aufgestellter, gewählter Natural Captain erhält den Bonus.',
    },
  ] as const;
  return (
    <section className="panel strength-panel" aria-labelledby="strength-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t('DIE IDEE HINTER DEINER ST\u00C4RKE')}</p>
          <h2 id="strength-title">{t('Teamst\u00E4rke & Boni')}</h2>
        </div>
        <span className="subtle-chip">
          {t(
            assessment
              ? complete
                ? 'Elf vollständig'
                : 'Vorschau · Coach oder Captain offen'
              : `${draft?.picks.length ?? 0} / 11 Spieler`,
          )}
        </span>
      </div>
      <div className="strength-layout">
        <div className="strength-total">
          <span>{t('Matchst\u00E4rke')}</span>
          <strong data-testid="match-strength" aria-live="polite">
            {t(values ? formatStrength(values.matchStrength) : '–')}
          </strong>
          <p>{t('Basisst\u00E4rke + begrenzte Boni')}</p>
          <small>
            {t(
              assessment
                ? `Mit Boni sind Werte über 99 möglich. Obergrenze: ${formatNumber(strengthModel.maximumStrength)}.`
                : 'Wird berechnet, sobald alle elf Positionen besetzt sind.',
            )}
          </small>
        </div>
        <div className="strength-breakdown">
          <div className="strength-base">
            <span>
              <strong>{t('Basisst\u00E4rke')}</strong>
              <small>{t('Positionsgewichtete Spielerqualit\u00E4t')}</small>
            </span>
            <strong data-testid="baseTeamStrength">
              {t(values ? formatStrength(values.baseTeamStrength) : '–')}
            </strong>
          </div>
          <dl>
            {metrics.map(({ key, label, cap, detail }) => (
              <div key={key}>
                <dt>
                  {t(label)}
                  <small>{t(detail)}</small>
                </dt>
                <dd>
                  <strong data-testid={key}>
                    {t(values ? `+${formatStrength(values[key])}` : '–')}
                  </strong>
                  <small>
                    {t('max. +')}
                    {t(formatNumber(cap))}
                  </small>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      {assessment && (
        <>
          <div className="strength-groups">
            {assessment.groups.map((group) => (
              <div key={group.group}>
                <span>
                  {t(groupLabels[group.group])}{' '}
                  <small>
                    {group.players}
                    {t(' Spieler')}
                  </small>
                </span>
                <strong>{t(formatStrength(group.average))}</strong>
                <small>
                  {t(formatNumber(group.weight * 100))}
                  {t(' % Gewicht')}
                </small>
              </div>
            ))}
          </div>
          <details className="strength-details">
            <summary>{t('Berechnung und Positionspassung ansehen')}</summary>
            <p>
              {t('Hauptposition: volle Wirkung. Nebenposition:')}
              {t(' ')}
              {t(formatNumber(strengthModel.rules.strength.positionFit.secondaryMultiplier * 100))}
              {t(
                ' % des Kartenratings. Die Basis verwendet die Durchschnittswerte der vier Positionsgruppen; leere Pl\u00E4tze werden nicht als fiktive Spieler bewertet.',
              )}
            </p>
            <div
              className="strength-table-wrap"
              role="region"
              tabIndex={0}
              aria-label={t('Positionsbeiträge')}
            >
              <table>
                <caption className="sr-only">
                  {t('Spielerratings und Positionspassung der aktuellen Elf')}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{t('Pos.')}</th>
                    <th scope="col">{t('Spieler')}</th>
                    <th scope="col">{t('Karte')}</th>
                    <th scope="col">{t('Passung')}</th>
                    <th scope="col">{t('Wirksam')}</th>
                  </tr>
                </thead>
                <tbody>
                  {assessment.contributions.map((player) => (
                    <tr key={player.slotId}>
                      <td>{player.position}</td>
                      <th scope="row">{player.name}</th>
                      <td>{player.rating}</td>
                      <td>
                        {t(player.fit === 'primary' ? 'Hauptposition' : 'Nebenposition')} ·{t(' ')}
                        {t(formatNumber(player.multiplier * 100))} %
                      </td>
                      <td>{t(formatStrength(player.effectiveRating))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              {t('Coach: ')}
              {t(formatNumber(strengthModel.rules.coach.formationShare * 100))}
              {t(' % Formationspassung, ')}
              {t(formatNumber(strengthModel.rules.coach.styleShare * 100))}
              {t(
                ' % Stilpassung, gewichtet mit dem Coach-Rating. Ein aufgestellter Natural Captain erh\u00E4lt nur als gew\u00E4hlter Captain einen Bonus. Angezeigte Werte sind gerundet; die Matchst\u00E4rke ist die Summe der ausgewiesenen Komponenten.',
              )}
            </p>
            <p>
              {t('Chemie: Ein L\u00E4nderpaar z\u00E4hlt mit Gewicht')}
              {t(' ')}
              {t(formatNumber(strengthModel.rules.chemistry.sameNationalityPairWeight))}
              {t(', ein Vereinspaar mit ')}
              {t(formatNumber(strengthModel.rules.chemistry.sameClubPairWeight))}
              {t('. F\u00FCr')}
              {t(' ')}
              {assessment.chemistry.pairs}
              {t(' Paare betr\u00E4gt das theoretische Maximum')}
              {t(' ')}
              {t(
                formatNumber(
                  assessment.chemistry.pairs *
                    (strengthModel.rules.chemistry.sameNationalityPairWeight +
                      strengthModel.rules.chemistry.sameClubPairWeight),
                ),
              )}
              {t(
                '; der passende Anteil wird mit der Chemiegrenze multipliziert. Beim Taktikbonus z\u00E4hlt jeder Spieler mit mindestens einem passenden Stil-Tag einmal.',
              )}
            </p>
          </details>
        </>
      )}
    </section>
  );
}
