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
          <p className="eyebrow">DIE IDEE HINTER DEINER STÄRKE</p>
          <h2 id="strength-title">Teamstärke & Boni</h2>
        </div>
        <span className="subtle-chip">
          {assessment
            ? complete
              ? 'Elf vollständig'
              : 'Vorschau · Coach oder Captain offen'
            : `${draft?.picks.length ?? 0} / 11 Spieler`}
        </span>
      </div>
      <div className="strength-layout">
        <div className="strength-total">
          <span>Matchstärke</span>
          <strong data-testid="match-strength" aria-live="polite">
            {values ? formatStrength(values.matchStrength) : '–'}
          </strong>
          <p>Basisstärke + begrenzte Boni</p>
          <small>
            {assessment
              ? `Mit Boni sind Werte über 99 möglich. Obergrenze: ${formatNumber(strengthModel.maximumStrength)}.`
              : 'Wird berechnet, sobald alle elf Positionen besetzt sind.'}
          </small>
        </div>
        <div className="strength-breakdown">
          <div className="strength-base">
            <span>
              <strong>Basisstärke</strong>
              <small>Positionsgewichtete Spielerqualität</small>
            </span>
            <strong data-testid="baseTeamStrength">
              {values ? formatStrength(values.baseTeamStrength) : '–'}
            </strong>
          </div>
          <dl>
            {metrics.map(({ key, label, cap, detail }) => (
              <div key={key}>
                <dt>
                  {label}
                  <small>{detail}</small>
                </dt>
                <dd>
                  <strong data-testid={key}>
                    {values ? `+${formatStrength(values[key])}` : '–'}
                  </strong>
                  <small>max. +{formatNumber(cap)}</small>
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
                  {groupLabels[group.group]} <small>{group.players} Spieler</small>
                </span>
                <strong>{formatStrength(group.average)}</strong>
                <small>{formatNumber(group.weight * 100)} % Gewicht</small>
              </div>
            ))}
          </div>
          <details className="strength-details">
            <summary>Berechnung und Positionspassung ansehen</summary>
            <p>
              Hauptposition: volle Wirkung. Nebenposition:{' '}
              {formatNumber(strengthModel.rules.strength.positionFit.secondaryMultiplier * 100)} %
              des Kartenratings. Die Basis verwendet die Durchschnittswerte der vier
              Positionsgruppen; leere Plätze werden nicht als fiktive Spieler bewertet.
            </p>
            <div
              className="strength-table-wrap"
              role="region"
              tabIndex={0}
              aria-label="Positionsbeiträge"
            >
              <table>
                <caption className="sr-only">
                  Spielerratings und Positionspassung der aktuellen Elf
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Pos.</th>
                    <th scope="col">Spieler</th>
                    <th scope="col">Karte</th>
                    <th scope="col">Passung</th>
                    <th scope="col">Wirksam</th>
                  </tr>
                </thead>
                <tbody>
                  {assessment.contributions.map((player) => (
                    <tr key={player.slotId}>
                      <td>{player.position}</td>
                      <th scope="row">{player.name}</th>
                      <td>{player.rating}</td>
                      <td>
                        {player.fit === 'primary' ? 'Hauptposition' : 'Nebenposition'} ·{' '}
                        {formatNumber(player.multiplier * 100)} %
                      </td>
                      <td>{formatStrength(player.effectiveRating)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Coach: {formatNumber(strengthModel.rules.coach.formationShare * 100)} %
              Formationspassung, {formatNumber(strengthModel.rules.coach.styleShare * 100)} %
              Stilpassung, gewichtet mit dem Coach-Rating. Ein aufgestellter Natural Captain erhält
              nur als gewählter Captain einen Bonus. Angezeigte Werte sind gerundet; die Matchstärke
              ist die Summe der ausgewiesenen Komponenten.
            </p>
            <p>
              Chemie: Ein Länderpaar zählt mit Gewicht{' '}
              {formatNumber(strengthModel.rules.chemistry.sameNationalityPairWeight)}, ein
              Vereinspaar mit {formatNumber(strengthModel.rules.chemistry.sameClubPairWeight)}. Für{' '}
              {assessment.chemistry.pairs} Paare beträgt das theoretische Maximum{' '}
              {formatNumber(
                assessment.chemistry.pairs *
                  (strengthModel.rules.chemistry.sameNationalityPairWeight +
                    strengthModel.rules.chemistry.sameClubPairWeight),
              )}
              ; der passende Anteil wird mit der Chemiegrenze multipliziert. Beim Taktikbonus zählt
              jeder Spieler mit mindestens einem passenden Stil-Tag einmal.
            </p>
          </details>
        </>
      )}
    </section>
  );
}
