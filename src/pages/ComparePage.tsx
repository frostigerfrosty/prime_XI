import { t, useLanguage } from '../i18n/react.ts';
import { ArrowLeftRight, ArrowRight } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formations, teams } from '../app/catalog.ts';
import { strengthModel } from '../app/game.ts';
import { CatalogNote, ClubBadge, PageHeading } from '../components/ui.tsx';
import { Pitch } from '../components/Pitch.tsx';
import { getDefaultSettings } from '../data/index.ts';
import { analyzePrimeTeam } from '../engine/match-team.ts';
import type { StrengthAnalysis } from '../engine/strength.ts';
import type { PrimeTeam } from '../types/database.ts';
import { formatStrength } from '../utils/display.ts';
import '../styles/compare.css';
const defaultLeft = 'milan-2006-2007';
const defaultRight = 'barcelona-2010-2011';
const tacticId = getDefaultSettings().defaultTactic;
const options = teams.toSorted(
  (a, b) => a.clubName.localeCompare(b.clubName, 'de') || b.year - a.year,
);
const label = (team: PrimeTeam) => `${team.clubName} · ${team.season}`;
const groupLabels = {
  goalkeeper: 'Torwart',
  defence: 'Abwehr',
  midfield: 'Mittelfeld',
  attack: 'Angriff',
};
const strengthMetrics = [
  ['matchStrength', 'Matchstärke'],
  ['baseTeamStrength', 'Basisstärke'],
  ['chemistryBonus', 'Teamchemie'],
  ['tacticalBonus', 'Taktik-Fit'],
  ['coachBonus', 'Coach-Bonus'],
  ['captainBonus', 'Captain-Bonus'],
] as const;
function TeamLineup({ team, analysis }: { team: PrimeTeam; analysis: StrengthAnalysis }) {
  useLanguage();
  const formation = formations.find((item) => item.id === team.formation)!;
  const lineup = team.defaultLineup.map((pick) => ({
    slotId: pick.slotId,
    player: team.players.find((player) => player.id === pick.playerId)!,
  }));
  return (
    <section className="panel compare-lineup" aria-label={t(`Standardelf ${label(team)}`)}>
      <div className="compare-identity">
        <ClubBadge clubId={team.clubId} size="large" />
        <div>
          <p className="eyebrow">{team.season}</p>
          <h2>{team.clubName}</h2>
        </div>
        <span className="subtle-chip">{team.formation}</span>
      </div>
      <dl className="compare-team-info">
        <div>
          <dt>{t('Coach')}</dt>
          <dd>{team.coach!.name}</dd>
        </div>
        <div>
          <dt>{t('Captain der Standardelf')}</dt>
          <dd>{t(analysis.captain.name ?? 'Nicht zugewiesen')}</dd>
        </div>
      </dl>
      <Pitch
        formation={formation}
        lineup={lineup}
        captainPersonId={analysis.captain.name ? team.captainPersonId : null}
      />
      <p className="compare-caption">
        {t('Redaktionelle Spielaufstellung; keine historische Matchaufstellung.')}
      </p>
      <details className="compare-lineup-details">
        <summary>{t('Standardelf als Liste ansehen')}</summary>
        <ul>
          {analysis.contributions.map((player) => (
            <li key={player.slotId}>
              <span>{player.position}</span>
              <strong>
                {player.name}
                {t(player.personId === team.captainPersonId ? ' (C)' : '')}
              </strong>
              <span>
                {player.rating}
                {t(' OVR')}
              </span>
            </li>
          ))}
        </ul>
      </details>
      <Link className="text-link" to={`/teams/${team.id}`}>
        {t('Kader und Teamdetails ')}
        <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </section>
  );
}
export default function ComparePage() {
  useLanguage();
  const [params, setParams] = useSearchParams();
  const latestParams = useRef(params);
  useLayoutEffect(() => {
    latestParams.current = params;
  }, [params]);
  const leftId = params.get('left') ?? defaultLeft;
  const rightId = params.get('right') ?? (leftId === defaultRight ? defaultLeft : defaultRight);
  const left = teams.find((team) => team.id === leftId);
  const right = teams.find((team) => team.id === rightId);
  const valid = left && right && left.id !== right.id;
  const leftAnalysis = valid ? analyzePrimeTeam(left, strengthModel, tacticId) : null;
  const rightAnalysis = valid ? analyzePrimeTeam(right, strengthModel, tacticId) : null;
  function select(side: 'left' | 'right', id: string) {
    const next = new URLSearchParams(latestParams.current);
    // Resolve implicit defaults before changing either side so the other choice stays put.
    const currentLeft = next.get('left') ?? defaultLeft;
    const currentRight =
      next.get('right') ?? (currentLeft === defaultRight ? defaultLeft : defaultRight);
    next.set('left', currentLeft);
    next.set('right', currentRight);
    next.set(side, id);
    latestParams.current = next;
    setParams(next);
  }
  function reset() {
    const next = new URLSearchParams();
    latestParams.current = next;
    setParams(next);
  }
  const metrics =
    leftAnalysis && rightAnalysis
      ? [
          { label: 'Ø Kartenrating der Elf', left: left!.teamRating!, right: right!.teamRating! },
          ...strengthMetrics.map(([key, title]) => ({
            label: title,
            left: leftAnalysis.strength[key],
            right: rightAnalysis.strength[key],
          })),
          ...leftAnalysis.groups.map((group, index) => ({
            label: groupLabels[group.group],
            left: group.average,
            right: rightAnalysis.groups[index]!.average,
          })),
        ]
      : [];
  return (
    <>
      <PageHeading
        eyebrow={t('ZWEI ÄREN. EIN VERGLEICH.')}
        title={t('Teamvergleich')}
        description={t(
          'Vergleiche Standardelf, Positionsgruppen und Matchstärke zweier Prime-Teams.',
        )}
      />
      <CatalogNote />
      <section className="panel compare-controls" aria-label={t('Teams für den Vergleich')}>
        {(['left', 'right'] as const).map((side) => (
          <label className="match-field" key={side}>
            <span>{t(side === 'left' ? 'Erstes Team' : 'Zweites Team')}</span>
            <select
              value={(side === 'left' ? left?.id : right?.id) ?? ''}
              onChange={(event) => select(side, event.target.value)}
            >
              <option value="" disabled>
                {t('Team ausw\u00E4hlen')}
              </option>
              {options.map((team) => (
                <option
                  key={team.id}
                  value={team.id}
                  disabled={team.id === (side === 'left' ? rightId : leftId)}
                >
                  {t(label(team))}
                </option>
              ))}
            </select>
          </label>
        ))}
        <button
          className="button button--secondary"
          disabled={!valid}
          onClick={() => {
            const next = new URLSearchParams(latestParams.current);
            const first = next.get('left') ?? defaultLeft;
            const second =
              next.get('right') ?? (first === defaultRight ? defaultLeft : defaultRight);
            next.set('left', second);
            next.set('right', first);
            latestParams.current = next;
            setParams(next);
          }}
        >
          <ArrowLeftRight size={16} aria-hidden="true" />
          {t(' Teams tauschen')}
        </button>
      </section>
      <p className="compare-caption">
        {t(
          'Kopiere die Adresse, um diesen Vergleich zu teilen. Deine Auswahl bleibt beim Neuladen erhalten.',
        )}
      </p>
      {!valid ? (
        <section className="panel compare-invalid">
          <h2>{t('Diese Paarung ist nicht verf\u00FCgbar.')}</h2>
          <p role="status">
            {t(
              !left || !right
                ? 'Mindestens ein Team aus dem Link ist nicht im Katalog.'
                : 'Wähle zwei verschiedene Saisonmannschaften.',
            )}
          </p>
          <button className="button button--secondary" onClick={reset}>
            {t('Vergleich zur\u00FCcksetzen')}
          </button>
        </section>
      ) : (
        leftAnalysis &&
        rightAnalysis && (
          <>
            <section className="panel compare-values" aria-labelledby="compare-values-title">
              <div className="section-heading">
                <h2 id="compare-values-title">{t('Die Werte im Vergleich')}</h2>
              </div>
              <p className="compare-caption">
                {t('Beide Teams mit Standardtaktik \u201E')}
                {t(leftAnalysis.tactic.label)}
                {t('\u201C. H\u00F6here Werte sind hervorgehoben.')}
              </p>
              <table className="compare-table">
                <caption className="sr-only">
                  {t('Spielwerte von ')}
                  {t(label(left))}
                  {t(' und ')}
                  {t(label(right))}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{t('Spielwert')}</th>
                    <th scope="col">{t(label(left))}</th>
                    <th scope="col">{t(label(right))}</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((metric) => (
                    <tr key={metric.label}>
                      <th scope="row">{t(metric.label)}</th>
                      {(['left', 'right'] as const).map((side) => (
                        <td key={side}>
                          <span
                            className={
                              metric[side] > metric[side === 'left' ? 'right' : 'left']
                                ? 'compare-higher'
                                : ''
                            }
                          >
                            {t(formatStrength(metric[side]))}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="compare-caption">
                {t(
                  'Matchst\u00E4rke = positionsgewichtete Basis + begrenzte Boni. Die Positionsgruppen ber\u00FCcksichtigen Haupt- und Nebenpositionen. Das \u00D8 Kartenrating bleibt davon getrennt. Ein h\u00F6herer Wert garantiert keinen Sieg.',
                )}
              </p>
              <div className="compare-actions">
                <Link
                  className="button button--primary"
                  to={`/test-match?home=${left.id}&away=${right.id}`}
                >
                  {t('Diese Paarung spielen ')}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <p>
                  {t('Erstes Team spielt als Heimteam. Das Testspiel startet auf neutralem Platz.')}
                </p>
              </div>
            </section>
            <div className="compare-lineups">
              <TeamLineup team={left} analysis={leftAnalysis} />
              <TeamLineup team={right} analysis={rightAnalysis} />
            </div>
          </>
        )
      )}
    </>
  );
}
