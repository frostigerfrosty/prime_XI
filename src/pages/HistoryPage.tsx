import { getIntlLocale } from '../i18n/locale.ts';
import { t, useLanguage } from '../i18n/react.ts';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, History, Trophy } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useHistory } from '../app/HistoryProvider.tsx';
import { formations } from '../app/catalog.ts';
import { EmptyState, PageHeading } from '../components/ui.tsx';
import type { HistoryEntry } from '../types/application.ts';
import { historyLimit } from '../engine/history.ts';
import { roundLabels } from '../utils/tournament-display.ts';
import { formatNumber, formatStrength } from '../utils/display.ts';
const outcomeLabels: Record<HistoryEntry['outcome'], string> = {
  champion: 'Turniersieger',
  league: 'Nach der Ligaphase ausgeschieden',
  playoffs: 'In den Playoffs ausgeschieden',
  'round-of-16': 'Im Achtelfinale ausgeschieden',
  'quarter-finals': 'Im Viertelfinale ausgeschieden',
  'semi-finals': 'Im Halbfinale ausgeschieden',
  final: 'Finalist',
};
const finished = (entry: HistoryEntry) =>
  new Date(entry.finishedAt).toLocaleString(getIntlLocale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
function Statistics({ statistics }: { statistics: HistoryEntry['statistics'] }) {
  useLanguage();
  return (
    <dl className="history-statistics" aria-label={t('Turnierstatistik')}>
      {(
        [
          ['Spiele', statistics.played],
          ['Siege', statistics.wins],
          ['Remis', statistics.draws],
          ['Niederlagen', statistics.losses],
          ['Tore', statistics.goalsFor],
          ['Gegentore', statistics.goalsAgainst],
        ] as const
      ).map(([label, value]) => (
        <div key={label}>
          <dt>{t(label)}</dt>
          <dd>{t(formatNumber(value))}</dd>
        </div>
      ))}
    </dl>
  );
}
function EntryDetail({ entry }: { entry: HistoryEntry }) {
  useLanguage();
  const team = entry.userTeam;
  return (
    <>
      <Link className="text-link" to="/history">
        <ArrowLeft size={16} aria-hidden="true" />
        {t(' Zum Turnierarchiv')}
      </Link>
      <PageHeading
        eyebrow={t('DEIN TURNIERRÜCKBLICK')}
        title={team.name}
        description={t(`Abgeschlossen am ${finished(entry)}`)}
      />
      <section className="panel history-detail" aria-label={t('Turnierabschluss')}>
        <p className="eyebrow">{t(entry.outcome === 'champion' ? 'DEIN POKAL' : 'DEIN WEG')}</p>
        <h2>{t(outcomeLabels[entry.outcome])}</h2>
        <p>
          {t('Turniersieger: ')}
          <strong>{entry.champion.label}</strong>
        </p>
        <p>
          {t('Ligaplatz ')}
          {entry.leaguePosition} · {entry.leaguePoints}
          {t(' Punkte')}
        </p>
        <Statistics statistics={entry.statistics} />
        <p className="tournament-caption">
          {t(
            'Siege, Remis und Niederlagen z\u00E4hlen den Spielstand nach 90 beziehungsweise 120 Minuten. Elfmeterschie\u00DFen entscheiden das Weiterkommen und bleiben aus Toren und Spielbilanz heraus.',
          )}
        </p>
        <p className="history-seed">
          {t('Turniercode: ')}
          <strong>{entry.seed}</strong>
        </p>
      </section>
      <section className="panel history-detail" aria-labelledby="history-matches-title">
        <h2 id="history-matches-title">{t('Deine Spiele')}</h2>
        <div
          className="history-table-wrap"
          tabIndex={0}
          role="region"
          aria-label={t('Archivierte Spielergebnisse')}
        >
          <table className="history-table" aria-label={t('Deine archivierten Spiele')}>
            <thead>
              <tr>
                <th scope="col">{t('Phase')}</th>
                <th scope="col">{t('Gegner')}</th>
                <th scope="col">{t('Spielort')}</th>
                <th scope="col">{t('Tore (Elf : Gegner)')}</th>
              </tr>
            </thead>
            <tbody>
              {entry.matches.map(({ fixture, opponent }) => {
                const home = fixture.homeParticipantId === 'user';
                const score = fixture.result.afterExtraTime ?? fixture.result.regularTime;
                const penalties = fixture.result.penalties;
                return (
                  <tr key={fixture.id}>
                    <th scope="row">
                      {t(
                        fixture.phase === 'league'
                          ? `Spieltag ${fixture.roundNumber}`
                          : `${roundLabels[fixture.phase]}${fixture.leg ? (fixture.leg === 1 ? ' · Hinspiel' : ' · Rückspiel') : ''}`,
                      )}
                    </th>
                    <td>{t(opponent.label)}</td>
                    <td>{t(fixture.neutralVenue ? 'Neutral' : home ? 'Heim' : 'Auswärts')}</td>
                    <td>
                      <strong>
                        {home ? score.home : score.away} : {home ? score.away : score.home}
                      </strong>
                      {fixture.result.afterExtraTime && (
                        <small>{t('nach Verl\u00E4ngerung')}</small>
                      )}
                      {penalties && (
                        <small>
                          {t('Elfmeterschie\u00DFen ')}
                          {home ? penalties.home : penalties.away} :{t(' ')}
                          {home ? penalties.away : penalties.home}
                        </small>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel history-detail" aria-labelledby="history-team-title">
        <h2 id="history-team-title">{t('Deine damalige Elf')}</h2>
        <p>
          {t(team.formationId)}
          {t(' \u00B7 Coach: ')}
          {team.coach.name}
          {t(' \u00B7 Matchst\u00E4rke')}
          {t(' ')}
          {t(formatStrength(team.strength.matchStrength))}
        </p>
        <p>
          {t('Captain:')}
          {t(' ')}
          {team.lineup.find(({ player }) => player.personId === team.captainPersonId)!.player.name}
        </p>
        <div
          className="history-table-wrap"
          tabIndex={0}
          role="region"
          aria-label={t('Archivierte Spieleraufstellung')}
        >
          <table className="history-table" aria-label={t('Archivierte Aufstellung')}>
            <thead>
              <tr>
                <th scope="col">{t('Position')}</th>
                <th scope="col">{t('Spieler')}</th>
                <th scope="col">{t('Saison')}</th>
                <th scope="col">{t('Rating')}</th>
              </tr>
            </thead>
            <tbody>
              {team.lineup.map(({ slotId, player }) => (
                <tr key={slotId}>
                  <th scope="row">
                    {t(
                      formations
                        .find((formation) => formation.id === team.formationId)!
                        .slots.find((slot) => slot.id === slotId)!
                        .acceptedPositions.join(' / '),
                    )}
                  </th>
                  <td>{player.name}</td>
                  <td>{player.season}</td>
                  <td>{player.rating}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="tournament-caption">
          {t(
            'Aufstellung und Spielwerte stammen aus diesem Turnier. Sp\u00E4tere \u00C4nderungen im Team Builder ver\u00E4ndern diesen R\u00FCckblick nicht.',
          )}
        </p>
      </section>
    </>
  );
}
export default function HistoryPage() {
  useLanguage();
  const { entries, warning, persisted, protectedArchive, reset } = useHistory();
  const { entryId } = useParams();
  const [query, setQuery] = useState('');
  const [onlyTitles, setOnlyTitles] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (confirmReset) dialog.current?.showModal();
    else dialog.current?.close();
  }, [confirmReset]);
  const selected = entries.find((entry) => entry.id === entryId);
  const visible = entries.filter(
    (entry) =>
      (!onlyTitles || entry.outcome === 'champion') &&
      `${entry.userTeam.name} ${entry.seed} ${entry.champion.label}`
        .toLocaleLowerCase('de')
        .includes(query.trim().toLocaleLowerCase('de')),
  );
  return (
    <>
      {warning && (
        <p className="builder-alert" role="alert">
          {t(warning)}
        </p>
      )}
      {error && (
        <p className="builder-alert builder-alert--error" role="alert">
          {t(error)}
        </p>
      )}
      {entryId ? (
        selected ? (
          <EntryDetail entry={selected} />
        ) : (
          <>
            <PageHeading
              eyebrow={t('DEINE GESCHICHTE')}
              title={t('Dieser Rückblick ist nicht im Archiv.')}
              description={t(
                'Er wurde in diesem Browser nicht gespeichert oder gehört nicht mehr zu den letzten 50 Turnieren.',
              )}
            />
            <Link className="button button--primary" to="/history">
              {t('Zum Turnierarchiv')}
            </Link>
          </>
        )
      ) : (
        <>
          <PageHeading
            eyebrow={t('DEINE GESCHICHTE')}
            title={t('Die Spiele bleiben.')}
            description={t(
              `Deine letzten ${historyLimit} abgeschlossenen Turniere. Deine Teams, Ergebnisse und Erfolge.`,
            )}
          />
          {!entries.length ? (
            <EmptyState
              icon={History}
              eyebrow={t('DAS ERSTE KAPITEL IST NOCH OFFEN')}
              title={t('Jede Legende fängt bei null an.')}
              description={t(
                'Du hast noch kein Turnier abgeschlossen. Deine Turniere werden nach dem Finale automatisch hier gespeichert.',
              )}
            />
          ) : (
            <>
              <div className="stat-grid" aria-label={t('Archivbilanz')}>
                {[
                  ['Turniere', entries.length],
                  ['Titel', entries.filter((entry) => entry.outcome === 'champion').length],
                  ['Spiele', entries.reduce((sum, entry) => sum + entry.statistics.played, 0)],
                  ['Tore', entries.reduce((sum, entry) => sum + entry.statistics.goalsFor, 0)],
                ].map(([label, value]) => (
                  <div className="stat-card panel" key={label}>
                    <span className="stat-icon">
                      <Trophy size={20} aria-hidden="true" />
                    </span>
                    <div>
                      <strong>{t(formatNumber(Number(value)))}</strong>
                      <span>{label}</span>
                    </div>
                  </div>
                ))}
              </div>
              <section className="panel history-filters" aria-label={t('Archivfilter')}>
                <label>
                  {t('Turniere durchsuchen')}
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t('Team, Turniercode oder Sieger')}
                  />
                </label>
                <label className="history-title-filter">
                  <input
                    type="checkbox"
                    checked={onlyTitles}
                    onChange={(event) => setOnlyTitles(event.target.checked)}
                  />
                  {t(' ')}
                  {t('Nur eigene Titel')}
                </label>
              </section>
              <p className="tournament-caption" role="status">
                {visible.length}
                {t(' von ')}
                {entries.length}
                {t(' Turnieren \u00B7')}
                {t(' ')}
                {t(persisted ? 'Im Browser gespeichert' : 'Archiv dieser Sitzung')}
              </p>
              <div className="history-list">
                {visible.map((entry) => (
                  <article
                    className="panel history-card"
                    key={entry.id}
                    data-testid="history-entry"
                  >
                    <div>
                      <p className="eyebrow">{t(finished(entry))}</p>
                      <h2>{entry.userTeam.name}</h2>
                      <p className="history-outcome">{t(outcomeLabels[entry.outcome])}</p>
                    </div>
                    <p>
                      {t('Turniersieger: ')}
                      {entry.champion.label}
                    </p>
                    <p>
                      {t('Ligaplatz ')}
                      {entry.leaguePosition} · {entry.leaguePoints}
                      {t(' Punkte')}
                    </p>
                    <Statistics statistics={entry.statistics} />
                    <Link
                      className="button button--secondary"
                      to={`/history/${encodeURIComponent(entry.id)}`}
                    >
                      {t('Turnier ansehen ')}
                      <ArrowUpRight size={16} aria-hidden="true" />
                    </Link>
                  </article>
                ))}
              </div>
              {!visible.length && (
                <p className="panel history-detail">
                  {t('Kein abgeschlossenes Turnier passt zu deinen Filtern.')}
                </p>
              )}
            </>
          )}
        </>
      )}
      {protectedArchive && (
        <button className="button button--secondary" onClick={() => setConfirmReset(true)}>
          {t('Besch\u00E4digtes Archiv zur\u00FCcksetzen')}
        </button>
      )}
      <dialog
        ref={dialog}
        className="builder-confirm"
        aria-labelledby="history-reset-title"
        onCancel={() => setConfirmReset(false)}
        onClose={() => setConfirmReset(false)}
      >
        <h2 id="history-reset-title">{t('Besch\u00E4digtes Archiv zur\u00FCcksetzen?')}</h2>
        <p>
          {t(
            'Die unlesbaren Archivdaten werden gel\u00F6scht. Dein aktuelles Turnier, deine gespeicherte Elf und dein Draft bleiben erhalten. Dieser Schritt kann nicht r\u00FCckg\u00E4ngig gemacht werden.',
          )}
        </p>
        <div className="confirm-actions">
          <button className="button button--secondary" onClick={() => setConfirmReset(false)}>
            {t('Abbrechen')}
          </button>
          <button
            className="button button--primary"
            onClick={() => {
              const success = reset();
              setConfirmReset(false);
              setError(
                success
                  ? ''
                  : 'Das Archiv konnte nicht zurückgesetzt werden. Prüfe den verfügbaren Browserspeicher.',
              );
            }}
          >
            {t('Archiv zur\u00FCcksetzen')}
          </button>
        </div>
      </dialog>
    </>
  );
}
