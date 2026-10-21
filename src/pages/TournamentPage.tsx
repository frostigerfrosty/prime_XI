import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Check, Dices, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDraft } from '../app/DraftProvider.tsx';
import { useTournament } from '../app/TournamentProvider.tsx';
import { gameRules, tournamentEngine } from '../app/game.ts';
import { CatalogNote, EmptyState, PageHeading } from '../components/ui.tsx';
import { formatStrength } from '../utils/display.ts';
import { TeamName, MatchRow } from '../components/TournamentTeams.tsx';
import { KnockoutPanel } from '../components/KnockoutPanel.tsx';
import { useHistory } from '../app/HistoryProvider.tsx';

const qualificationText = {
  direct: 'Achtelfinale',
  playoff: 'Playoffs',
  eliminated: 'Ausgeschieden',
};
export default function TournamentPage() {
  const { currentTeam, teamWarning } = useDraft();
  const { tournament, warning, persisted, start, advance } = useTournament();
  const { warning: historyWarning } = useHistory();
  const [seed, setSeed] = useState<string>(() => crypto.randomUUID());
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedRound, setSelectedRound] = useState(1);
  const [pending, setPending] = useState<'restart' | 'finish' | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const overview = useRef<HTMLElement>(null);
  useEffect(() => {
    if (pending) dialog.current?.showModal();
    else dialog.current?.close();
  }, [pending]);
  function begin(replace = false) {
    try {
      if (!currentTeam) throw new Error('Speichere zuerst deine vollständige Elf im Team Builder.');
      start(currentTeam, seed.trim(), replace);
      setSelectedRound(1);
      setError('');
      setMessage('36 Teams ausgelost. Dein Turnier ist bereit für den ersten Spieltag.');
      requestAnimationFrame(() => overview.current?.focus());
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Das Turnier konnte nicht gestartet werden.',
      );
    }
  }
  const progress = tournament ? tournamentEngine.progress(tournament) : null;
  function play(all = false) {
    if (!progress?.nextRound) return;
    try {
      advance(progress.nextRound, all);
      setSelectedRound(all ? progress.totalRounds : progress.nextRound);
      setMessage(
        all || progress.nextRound === progress.totalRounds
          ? 'Ligaphase beendet. Die Abschlusstabelle steht fest.'
          : `Spieltag ${progress.nextRound} simuliert. Alle 18 Ergebnisse sind eingetragen.`,
      );
      setError('');
      requestAnimationFrame(() => {
        const destination =
          all || progress.nextRound === progress.totalRounds
            ? document.getElementById('knockout-panel')
            : overview.current;
        destination?.focus();
      });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Der Spieltag konnte nicht simuliert werden.',
      );
    }
  }
  function confirm(event: FormEvent) {
    event.preventDefault();
    const action = pending;
    setPending(null);
    if (action === 'restart') begin(true);
    else if (action === 'finish') play(true);
  }
  const participants = new Map(tournament?.participants.map((p) => [p.id, p]));
  const own = tournament?.participants.find((p) => p.id === tournament.userParticipantId);
  const ownRow = tournament?.standings.find(
    (row) => row.participantId === tournament.userParticipantId,
  );
  const ownMatches =
    tournament?.matches.filter(
      (m) =>
        m.phase === 'league' &&
        (m.homeParticipantId === tournament.userParticipantId ||
          m.awayParticipantId === tournament.userParticipantId),
    ) ?? [];
  const nextMatch = ownMatches.find((m) => m.status === 'scheduled');
  const lastMatch = ownMatches.filter((m) => m.status === 'played').at(-1);
  const complete = progress?.complete ?? false;
  const status = ownRow ? tournamentEngine.qualification(ownRow.rank) : null;
  const qualification = complete && status ? qualificationText[status] : null;

  return (
    <>
      <div className="tournament-heading">
        <PageHeading
          eyebrow="DIE GRÖSSTE BÜHNE"
          title="Dein Turnier"
          description="Deine Elf. 35 Gegner. Ein Weg bis zum Pokal."
        />
        {tournament && (
          <button
            className="button button--secondary"
            disabled={!currentTeam}
            onClick={() => {
              setSeed(crypto.randomUUID());
              setPending('restart');
            }}
          >
            <Dices size={16} aria-hidden="true" />
            Neues Turnier
          </button>
        )}
      </div>
      {warning && (
        <p className="builder-alert" role="alert">
          {warning}
        </p>
      )}
      {tournament?.phase === 'completed' && (
        <>
          {historyWarning && (
            <p className="builder-alert" role="alert">
              {historyWarning}
            </p>
          )}
          <Link className="button button--secondary" to="/history">
            Zum Turnierarchiv
          </Link>
        </>
      )}
      {error && (
        <p className="builder-alert builder-alert--error" role="alert">
          {error}
        </p>
      )}
      <p className="tournament-feedback" role="status">
        {message}
      </p>
      {!tournament ? (
        <>
          {currentTeam ? (
            <section className="panel tournament-start">
              <Trophy size={36} aria-hidden="true" />
              <p className="eyebrow">DEINE ELF IST BEREIT</p>
              <h2>Die große Bühne wartet.</h2>
              <p>
                {currentTeam.name} · Matchstärke{' '}
                {formatStrength(currentTeam.strength.matchStrength)}. Du spielst gegen 35
                verschiedene Saisonmannschaften aus dem Prime-Katalog.
              </p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  begin();
                }}
              >
                <label className="match-field">
                  <span>Turniercode</span>
                  <input
                    required
                    maxLength={100}
                    value={seed}
                    onChange={(event) => setSeed(event.target.value)}
                    aria-describedby="tournament-code-help"
                  />
                </label>
                <p className="match-help" id="tournament-code-help">
                  Gleicher Code und gleiche gespeicherte Elf wiederholen Auslosung und Ergebnisse.
                </p>
                <button type="submit" className="button button--primary">
                  Turnier starten <ArrowRight size={16} aria-hidden="true" />
                </button>
              </form>
            </section>
          ) : (
            <EmptyState
              icon={Trophy}
              eyebrow="NOCH KEIN ANPFIFF"
              title="Große Spiele brauchen eine vollständige Elf."
              description="Vervollständige deine Aufstellung mit Coach und Captain im Team Builder und speichere sie. Danach startet hier deine Ligaphase."
            />
          )}
          {!currentTeam && teamWarning && (
            <p className="builder-alert" role="alert">
              {teamWarning}
            </p>
          )}
          <div className="format-strip panel">
            <span>
              <strong>36</strong> Teilnehmer
            </span>
            <span>
              <strong>8</strong> Ligaspiele pro Team
            </span>
            <span>
              <strong>4 + 4</strong> Heim- und Auswärtsspiele
            </span>
            <p>Plätze 1–8 direkt ins Achtelfinale · 9–24 Playoffs · 25–36 ausgeschieden</p>
          </div>
          <Link className="text-link" to="/test-match">
            Oder zuerst ein Testspiel spielen <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </>
      ) : (
        own &&
        ownRow &&
        progress && (
          <>
            {complete && (
              <KnockoutPanel tournament={tournament} onMessage={setMessage} onError={setError} />
            )}
            <section
              className="panel tournament-overview"
              ref={overview}
              tabIndex={-1}
              aria-label="Dein Ligastand"
            >
              <div className="section-heading">
                <div>
                  <p className="eyebrow">{complete ? 'ABSCHLUSSTABELLE' : 'LIGAPHASE'}</p>
                  <h2>{complete ? 'Acht Spiele. Dein Ergebnis.' : 'Jeder Punkt zählt.'}</h2>
                </div>
                <span className="subtle-chip">
                  {persisted ? 'Im Browser gespeichert' : 'Nur in dieser Sitzung'}
                </span>
              </div>
              <div className="league-stats">
                <div>
                  <span>Dein Ligaplatz</span>
                  <strong data-testid="user-league-rank">
                    {ownRow.played ? ownRow.rank : '–'}
                  </strong>
                  <small>{complete ? qualification : 'Aktueller Stand'}</small>
                </div>
                <div>
                  <span>Punkte</span>
                  <strong data-testid="user-league-points">{ownRow.points}</strong>
                  <small>
                    {ownRow.wins} Siege · {ownRow.draws} Remis
                  </small>
                </div>
                <div>
                  <span>Deine Spiele</span>
                  <strong>
                    {ownRow.played}
                    <small> / {progress.totalRounds}</small>
                  </strong>
                  <small>
                    {ownRow.goalsFor} : {ownRow.goalsAgainst} Tore
                  </small>
                </div>
                <div>
                  <span>Matchstärke</span>
                  <strong>{formatStrength(own.matchStrength)}</strong>
                  <small>Elf vom Turnierstart</small>
                </div>
              </div>
              <div className="league-progress">
                <label htmlFor="league-progress">
                  {progress.completedRounds} von {progress.totalRounds} Spieltagen abgeschlossen
                </label>
                <progress
                  id="league-progress"
                  value={progress.completedRounds}
                  max={progress.totalRounds}
                />
              </div>
              <p className="tournament-caption">
                Aufstellung, Gegner und Spielwerte bleiben für dieses Turnier erhalten, auch wenn du
                dein Team im Builder veränderst.
              </p>
            </section>
            {complete ? (
              <section
                className={`panel qualification-panel qualification-panel--${status}`}
                aria-labelledby="qualification-title"
              >
                <Check size={25} aria-hidden="true" />
                <div>
                  <p className="eyebrow">LIGAPHASE BEENDET</p>
                  <h2 id="qualification-title">{qualification}</h2>
                  <p>
                    Deine Elf beendet die Ligaphase auf Platz {ownRow.rank} mit {ownRow.points}{' '}
                    Punkten.{' '}
                    {status === 'eliminated'
                      ? 'Damit verpasst sie die K.-o.-Runden.'
                      : 'Dein Platz in der nächsten Runde steht fest.'}
                  </p>
                  <p>
                    Die K.-o.-Runden sind spielbereit. Du kannst das Turnier auch nach dem
                    Ausscheiden deiner Elf weiterverfolgen.
                  </p>
                </div>
              </section>
            ) : (
              nextMatch && (
                <section className="panel next-league-match">
                  <div className="section-heading">
                    <h2>Nächstes Spiel</h2>
                    <span className="subtle-chip">Spieltag {progress.nextRound}</span>
                  </div>
                  <ul className="league-match-list">
                    <MatchRow
                      match={nextMatch}
                      participants={participants}
                      userId={tournament.userParticipantId}
                    />
                  </ul>
                  <div className="league-play-actions">
                    <button className="button button--primary" onClick={() => play()}>
                      Spieltag {progress.nextRound} simulieren{' '}
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                    <button
                      className="button button--secondary"
                      onClick={() => setPending('finish')}
                    >
                      Restliche Ligaphase simulieren
                    </button>
                  </div>
                  <p className="tournament-caption">
                    Ein Spieltag spielt alle 18 Begegnungen aus. Deine Tabelle bleibt dadurch auf
                    demselben Stand wie die Ergebnisse der anderen Teams.
                  </p>
                </section>
              )
            )}
            {lastMatch && (
              <section className="panel last-league-match">
                <p className="eyebrow">DEIN LETZTES ERGEBNIS · SPIELTAG {lastMatch.roundNumber}</p>
                <ul className="league-match-list">
                  <MatchRow
                    match={lastMatch}
                    participants={participants}
                    userId={tournament.userParticipantId}
                  />
                </ul>
              </section>
            )}
            <details className="league-archive" open={tournament.phase === 'league'}>
              <summary>Ligatabelle und Spielplan ansehen</summary>
              <section className="panel league-table-panel" aria-labelledby="league-table-title">
                <div className="section-heading">
                  <h2 id="league-table-title">Ligatabelle</h2>
                  <span className="subtle-chip">
                    36 Teams ·{' '}
                    {
                      tournament.matches.filter(
                        (m) => m.phase === 'league' && m.status === 'played',
                      ).length
                    }{' '}
                    / 144 Spiele
                  </span>
                </div>
                <div className="league-legend">
                  <span>1–8 · Achtelfinale</span>
                  <span>9–24 · Playoffs</span>
                  <span>25–36 · Aus</span>
                </div>
                <div
                  className="league-table-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label="Vollständige Ligatabelle horizontal scrollen"
                >
                  <table aria-label="Ligatabelle">
                    <caption className="sr-only">
                      {complete ? 'Endstand' : 'Zwischenstand'} nach {progress.completedRounds}{' '}
                      Spieltagen. Sortierung: Punkte, Tordifferenz, Tore, Siege, Teilnehmer-ID.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Pl.</th>
                        <th scope="col">Mannschaft</th>
                        <th scope="col">
                          <abbr title="Spiele">Sp.</abbr>
                        </th>
                        <th scope="col">
                          <abbr title="Siege">S</abbr>
                        </th>
                        <th scope="col">
                          <abbr title="Unentschieden">U</abbr>
                        </th>
                        <th scope="col">
                          <abbr title="Niederlagen">N</abbr>
                        </th>
                        <th scope="col">Tore</th>
                        <th scope="col">
                          <abbr title="Tordifferenz">TD</abbr>
                        </th>
                        <th scope="col">
                          <abbr title="Punkte">Pkt.</abbr>
                        </th>
                        <th scope="col">Zone</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tournament.standings.map((row) => {
                        const zone = tournamentEngine.qualification(row.rank);
                        return (
                          <tr
                            key={row.participantId}
                            data-testid={`league-row-${row.participantId}`}
                            className={
                              row.participantId === tournament.userParticipantId
                                ? 'league-row--own'
                                : ''
                            }
                          >
                            <td
                              className={
                                progress.completedRounds
                                  ? `league-rank league-rank--${zone}`
                                  : 'league-rank'
                              }
                            >
                              {row.rank}
                            </td>
                            <th scope="row">
                              <TeamName participant={participants.get(row.participantId)!} />
                            </th>
                            <td>{row.played}</td>
                            <td>{row.wins}</td>
                            <td>{row.draws}</td>
                            <td>{row.losses}</td>
                            <td>
                              {row.goalsFor}:{row.goalsAgainst}
                            </td>
                            <td>
                              {row.goalDifference > 0 ? '+' : ''}
                              {row.goalDifference}
                            </td>
                            <td className="league-points">{row.points}</td>
                            <td className="league-zone">
                              {progress.completedRounds ? qualificationText[zone] : '–'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="tournament-caption">
                  {complete
                    ? 'Die Qualifikationsplätze sind endgültig.'
                    : 'Die Zonen zeigen den aktuellen Stand. Qualifiziert wird erst nach allen acht Spieltagen.'}{' '}
                  Bei Punktgleichheit zählen Tordifferenz, Tore, Siege und zuletzt die stabile
                  Teilnehmer-ID.
                </p>
              </section>
              <div className="league-fixture-grid">
                <section className="panel league-fixtures">
                  <div className="section-heading">
                    <h2>Dein Spielplan</h2>
                    <span className="subtle-chip">4 Heim · 4 Auswärts</span>
                  </div>
                  <ol className="league-match-list own-league-fixtures">
                    {ownMatches.map((match) => (
                      <li key={match.id}>
                        <p className="eyebrow">
                          Spieltag {match.roundNumber} ·{' '}
                          {match.homeParticipantId === tournament.userParticipantId
                            ? 'Heimspiel'
                            : 'Auswärtsspiel'}
                        </p>
                        <ul>
                          <MatchRow
                            match={match}
                            participants={participants}
                            userId={tournament.userParticipantId}
                          />
                        </ul>
                      </li>
                    ))}
                  </ol>
                </section>
                <section className="panel league-fixtures">
                  <div className="section-heading">
                    <h2>Alle Begegnungen</h2>
                    <label className="league-round-select">
                      <span>Spieltag anzeigen</span>
                      <select
                        value={selectedRound}
                        onChange={(event) => setSelectedRound(Number(event.target.value))}
                      >
                        {Array.from({ length: progress.totalRounds }, (_, i) => (
                          <option key={i + 1} value={i + 1}>
                            Spieltag {i + 1}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <ul className="league-match-list all-league-fixtures">
                    {tournament.matches
                      .filter(
                        (match) => match.phase === 'league' && match.roundNumber === selectedRound,
                      )
                      .map((match) => (
                        <MatchRow
                          key={match.id}
                          match={match}
                          participants={participants}
                          userId={tournament.userParticipantId}
                        />
                      ))}
                  </ul>
                </section>
              </div>
            </details>
            <details className="panel tournament-code-details">
              <summary>Turniercode und Spielregeln</summary>
              <p>
                Turniercode: <code>{tournament.seed}</code>
              </p>
              <p>
                {gameRules.tournament.totalTeams} Teilnehmer ·{' '}
                {gameRules.tournament.league.matchesPerTeam} verschiedene Gegner · Sieg{' '}
                {gameRules.tournament.league.winPoints}, Remis{' '}
                {gameRules.tournament.league.drawPoints}, Niederlage{' '}
                {gameRules.tournament.league.lossPoints} Punkte. Verschiedene Saisons desselben
                Vereins dürfen teilnehmen. Die Auslosung verwendet keine UEFA-Töpfe oder
                Länderbeschränkungen.
              </p>
            </details>
          </>
        )
      )}
      <CatalogNote />
      <dialog
        ref={dialog}
        className="builder-confirm tournament-confirm"
        aria-labelledby="tournament-confirm-title"
        onCancel={() => setPending(null)}
        onClose={() => setPending(null)}
      >
        <form onSubmit={confirm}>
          <p className="eyebrow">
            {pending === 'restart' ? 'NEUE AUSLOSUNG' : 'BIS ZUM ACHTEN SPIELTAG'}
          </p>
          <h2 id="tournament-confirm-title">
            {pending === 'restart'
              ? 'Bisheriges Turnier ersetzen?'
              : 'Restliche Ligaphase simulieren?'}
          </h2>
          <p>
            {pending === 'restart'
              ? tournament?.phase === 'completed'
                ? 'Dein abgeschlossener Turnierrückblick bleibt im Archiv erhalten. Das neue Turnier verwendet deine zuletzt gespeicherte Elf. Dein Draft bleibt erhalten.'
                : 'Dein bisheriger Spielplan und alle Ergebnisse werden durch ein neues Turnier mit deiner zuletzt gespeicherten Elf ersetzt. Dein Draft bleibt erhalten.'
              : 'Alle noch offenen Spiele werden simuliert. Danach steht deine endgültige Ligaplatzierung fest.'}
          </p>
          {pending === 'restart' && (
            <label className="match-field">
              <span>Turniercode</span>
              <input
                required
                maxLength={100}
                value={seed}
                onChange={(event) => setSeed(event.target.value)}
              />
            </label>
          )}
          <div className="confirm-actions">
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setPending(null)}
            >
              Abbrechen
            </button>
            <button type="submit" className="button button--primary">
              Bestätigen
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
