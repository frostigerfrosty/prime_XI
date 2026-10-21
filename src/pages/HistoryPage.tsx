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
  new Date(entry.finishedAt).toLocaleString('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

function Statistics({ statistics }: { statistics: HistoryEntry['statistics'] }) {
  return (
    <dl className="history-statistics" aria-label="Turnierstatistik">
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
          <dt>{label}</dt>
          <dd>{formatNumber(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function EntryDetail({ entry }: { entry: HistoryEntry }) {
  const team = entry.userTeam;
  return (
    <>
      <Link className="text-link" to="/history">
        <ArrowLeft size={16} aria-hidden="true" /> Zum Turnierarchiv
      </Link>
      <PageHeading
        eyebrow="DEIN TURNIERRÜCKBLICK"
        title={team.name}
        description={`Abgeschlossen am ${finished(entry)}`}
      />
      <section className="panel history-detail" aria-label="Turnierabschluss">
        <p className="eyebrow">{entry.outcome === 'champion' ? 'DEIN POKAL' : 'DEIN WEG'}</p>
        <h2>{outcomeLabels[entry.outcome]}</h2>
        <p>
          Turniersieger: <strong>{entry.champion.label}</strong>
        </p>
        <p>
          Ligaplatz {entry.leaguePosition} · {entry.leaguePoints} Punkte
        </p>
        <Statistics statistics={entry.statistics} />
        <p className="tournament-caption">
          Siege, Remis und Niederlagen zählen den Spielstand nach 90 beziehungsweise 120 Minuten.
          Elfmeterschießen entscheiden das Weiterkommen und bleiben aus Toren und Spielbilanz
          heraus.
        </p>
        <p className="history-seed">
          Turniercode: <strong>{entry.seed}</strong>
        </p>
      </section>
      <section className="panel history-detail" aria-labelledby="history-matches-title">
        <h2 id="history-matches-title">Deine Spiele</h2>
        <div
          className="history-table-wrap"
          tabIndex={0}
          role="region"
          aria-label="Archivierte Spielergebnisse"
        >
          <table className="history-table" aria-label="Deine archivierten Spiele">
            <thead>
              <tr>
                <th scope="col">Phase</th>
                <th scope="col">Gegner</th>
                <th scope="col">Spielort</th>
                <th scope="col">Tore (Elf : Gegner)</th>
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
                      {fixture.phase === 'league'
                        ? `Spieltag ${fixture.roundNumber}`
                        : `${roundLabels[fixture.phase]}${fixture.leg ? (fixture.leg === 1 ? ' · Hinspiel' : ' · Rückspiel') : ''}`}
                    </th>
                    <td>{opponent.label}</td>
                    <td>{fixture.neutralVenue ? 'Neutral' : home ? 'Heim' : 'Auswärts'}</td>
                    <td>
                      <strong>
                        {home ? score.home : score.away} : {home ? score.away : score.home}
                      </strong>
                      {fixture.result.afterExtraTime && <small>nach Verlängerung</small>}
                      {penalties && (
                        <small>
                          Elfmeterschießen {home ? penalties.home : penalties.away} :{' '}
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
        <h2 id="history-team-title">Deine damalige Elf</h2>
        <p>
          {team.formationId} · Coach: {team.coach.name} · Matchstärke{' '}
          {formatStrength(team.strength.matchStrength)}
        </p>
        <p>
          Captain:{' '}
          {team.lineup.find(({ player }) => player.personId === team.captainPersonId)!.player.name}
        </p>
        <div
          className="history-table-wrap"
          tabIndex={0}
          role="region"
          aria-label="Archivierte Spieleraufstellung"
        >
          <table className="history-table" aria-label="Archivierte Aufstellung">
            <thead>
              <tr>
                <th scope="col">Position</th>
                <th scope="col">Spieler</th>
                <th scope="col">Saison</th>
                <th scope="col">Rating</th>
              </tr>
            </thead>
            <tbody>
              {team.lineup.map(({ slotId, player }) => (
                <tr key={slotId}>
                  <th scope="row">
                    {formations
                      .find((formation) => formation.id === team.formationId)!
                      .slots.find((slot) => slot.id === slotId)!
                      .acceptedPositions.join(' / ')}
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
          Aufstellung und Spielwerte stammen aus diesem Turnier. Spätere Änderungen im Team Builder
          verändern diesen Rückblick nicht.
        </p>
      </section>
    </>
  );
}

export default function HistoryPage() {
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
          {warning}
        </p>
      )}
      {error && (
        <p className="builder-alert builder-alert--error" role="alert">
          {error}
        </p>
      )}
      {entryId ? (
        selected ? (
          <EntryDetail entry={selected} />
        ) : (
          <>
            <PageHeading
              eyebrow="DEINE GESCHICHTE"
              title="Dieser Rückblick ist nicht im Archiv."
              description="Er wurde in diesem Browser nicht gespeichert oder gehört nicht mehr zu den letzten 50 Turnieren."
            />
            <Link className="button button--primary" to="/history">
              Zum Turnierarchiv
            </Link>
          </>
        )
      ) : (
        <>
          <PageHeading
            eyebrow="DEINE GESCHICHTE"
            title="Die Spiele bleiben."
            description={`Deine letzten ${historyLimit} abgeschlossenen Turniere. Deine Teams, Ergebnisse und Erfolge.`}
          />
          {!entries.length ? (
            <EmptyState
              icon={History}
              eyebrow="DAS ERSTE KAPITEL IST NOCH OFFEN"
              title="Jede Legende fängt bei null an."
              description="Du hast noch kein Turnier abgeschlossen. Deine Turniere werden nach dem Finale automatisch hier gespeichert."
            />
          ) : (
            <>
              <div className="stat-grid" aria-label="Archivbilanz">
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
                      <strong>{formatNumber(Number(value))}</strong>
                      <span>{label}</span>
                    </div>
                  </div>
                ))}
              </div>
              <section className="panel history-filters" aria-label="Archivfilter">
                <label>
                  Turniere durchsuchen
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Team, Turniercode oder Sieger"
                  />
                </label>
                <label className="history-title-filter">
                  <input
                    type="checkbox"
                    checked={onlyTitles}
                    onChange={(event) => setOnlyTitles(event.target.checked)}
                  />{' '}
                  Nur eigene Titel
                </label>
              </section>
              <p className="tournament-caption" role="status">
                {visible.length} von {entries.length} Turnieren ·{' '}
                {persisted ? 'Im Browser gespeichert' : 'Archiv dieser Sitzung'}
              </p>
              <div className="history-list">
                {visible.map((entry) => (
                  <article
                    className="panel history-card"
                    key={entry.id}
                    data-testid="history-entry"
                  >
                    <div>
                      <p className="eyebrow">{finished(entry)}</p>
                      <h2>{entry.userTeam.name}</h2>
                      <p className="history-outcome">{outcomeLabels[entry.outcome]}</p>
                    </div>
                    <p>Turniersieger: {entry.champion.label}</p>
                    <p>
                      Ligaplatz {entry.leaguePosition} · {entry.leaguePoints} Punkte
                    </p>
                    <Statistics statistics={entry.statistics} />
                    <Link
                      className="button button--secondary"
                      to={`/history/${encodeURIComponent(entry.id)}`}
                    >
                      Turnier ansehen <ArrowUpRight size={16} aria-hidden="true" />
                    </Link>
                  </article>
                ))}
              </div>
              {!visible.length && (
                <p className="panel history-detail">
                  Kein abgeschlossenes Turnier passt zu deinen Filtern.
                </p>
              )}
            </>
          )}
        </>
      )}
      {protectedArchive && (
        <button className="button button--secondary" onClick={() => setConfirmReset(true)}>
          Beschädigtes Archiv zurücksetzen
        </button>
      )}
      <dialog
        ref={dialog}
        className="builder-confirm"
        aria-labelledby="history-reset-title"
        onCancel={() => setConfirmReset(false)}
        onClose={() => setConfirmReset(false)}
      >
        <h2 id="history-reset-title">Beschädigtes Archiv zurücksetzen?</h2>
        <p>
          Die unlesbaren Archivdaten werden gelöscht. Dein aktuelles Turnier, deine gespeicherte Elf
          und dein Draft bleiben erhalten. Dieser Schritt kann nicht rückgängig gemacht werden.
        </p>
        <div className="confirm-actions">
          <button className="button button--secondary" onClick={() => setConfirmReset(false)}>
            Abbrechen
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
            Archiv zurücksetzen
          </button>
        </div>
      </dialog>
    </>
  );
}
