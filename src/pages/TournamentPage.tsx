import { t, useLanguage } from '../i18n/react.ts';
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
  useLanguage();
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
          eyebrow={t('DIE GRÖSSTE BÜHNE')}
          title={t('Dein Turnier')}
          description={t('Deine Elf. 35 Gegner. Ein Weg bis zum Pokal.')}
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
            {t('Neues Turnier')}
          </button>
        )}
      </div>
      {warning && (
        <p className="builder-alert" role="alert">
          {t(warning)}
        </p>
      )}
      {tournament?.phase === 'completed' && (
        <>
          {historyWarning && (
            <p className="builder-alert" role="alert">
              {t(historyWarning)}
            </p>
          )}
          <Link className="button button--secondary" to="/history">
            {t('Zum Turnierarchiv')}
          </Link>
        </>
      )}
      {error && (
        <p className="builder-alert builder-alert--error" role="alert">
          {t(error)}
        </p>
      )}
      <p className="tournament-feedback" role="status">
        {t(message)}
      </p>
      {!tournament ? (
        <>
          {currentTeam ? (
            <section className="panel tournament-start">
              <Trophy size={36} aria-hidden="true" />
              <p className="eyebrow">{t('DEINE ELF IST BEREIT')}</p>
              <h2>{t('Die gro\u00DFe B\u00FChne wartet.')}</h2>
              <p>
                {currentTeam.name}
                {t(' \u00B7 Matchst\u00E4rke')}
                {t(' ')}
                {t(formatStrength(currentTeam.strength.matchStrength))}
                {t('. Du spielst gegen 35 verschiedene Saisonmannschaften aus dem Prime-Katalog.')}
              </p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  begin();
                }}
              >
                <label className="match-field">
                  <span>{t('Turniercode')}</span>
                  <input
                    required
                    maxLength={100}
                    value={seed}
                    onChange={(event) => setSeed(event.target.value)}
                    aria-describedby="tournament-code-help"
                  />
                </label>
                <p className="match-help" id="tournament-code-help">
                  {t(
                    'Gleicher Code und gleiche gespeicherte Elf wiederholen Auslosung und Ergebnisse.',
                  )}
                </p>
                <button type="submit" className="button button--primary">
                  {t('Turnier starten ')}
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </form>
            </section>
          ) : (
            <EmptyState
              icon={Trophy}
              eyebrow={t('NOCH KEIN ANPFIFF')}
              title={t('Große Spiele brauchen eine vollständige Elf.')}
              description={t(
                'Vervollständige deine Aufstellung mit Coach und Captain im Team Builder und speichere sie. Danach startet hier deine Ligaphase.',
              )}
            />
          )}
          {!currentTeam && teamWarning && (
            <p className="builder-alert" role="alert">
              {t(teamWarning)}
            </p>
          )}
          <div className="format-strip panel">
            <span>
              <strong>36</strong>
              {t(' Teilnehmer')}
            </span>
            <span>
              <strong>8</strong>
              {t(' Ligaspiele pro Team')}
            </span>
            <span>
              <strong>4 + 4</strong>
              {t(' Heim- und Ausw\u00E4rtsspiele')}
            </span>
            <p>
              {t(
                'Pl\u00E4tze 1\u20138 direkt ins Achtelfinale \u00B7 9\u201324 Playoffs \u00B7 25\u201336 ausgeschieden',
              )}
            </p>
          </div>
          <Link className="text-link" to="/test-match">
            {t('Oder zuerst ein Testspiel spielen ')}
            <ArrowRight size={15} aria-hidden="true" />
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
              aria-label={t('Dein Ligastand')}
            >
              <div className="section-heading">
                <div>
                  <p className="eyebrow">{t(complete ? 'ABSCHLUSSTABELLE' : 'LIGAPHASE')}</p>
                  <h2>{t(complete ? 'Acht Spiele. Dein Ergebnis.' : 'Jeder Punkt zählt.')}</h2>
                </div>
                <span className="subtle-chip">
                  {t(persisted ? 'Im Browser gespeichert' : 'Nur in dieser Sitzung')}
                </span>
              </div>
              <div className="league-stats">
                <div>
                  <span>{t('Dein Ligaplatz')}</span>
                  <strong data-testid="user-league-rank">
                    {ownRow.played ? ownRow.rank : '–'}
                  </strong>
                  <small>{complete ? qualification : 'Aktueller Stand'}</small>
                </div>
                <div>
                  <span>{t('Punkte')}</span>
                  <strong data-testid="user-league-points">{ownRow.points}</strong>
                  <small>
                    {ownRow.wins}
                    {t(' Siege \u00B7 ')}
                    {ownRow.draws}
                    {t(' Remis')}
                  </small>
                </div>
                <div>
                  <span>{t('Deine Spiele')}</span>
                  <strong>
                    {ownRow.played}
                    <small> / {progress.totalRounds}</small>
                  </strong>
                  <small>
                    {ownRow.goalsFor} : {ownRow.goalsAgainst}
                    {t(' Tore')}
                  </small>
                </div>
                <div>
                  <span>{t('Matchst\u00E4rke')}</span>
                  <strong>{t(formatStrength(own.matchStrength))}</strong>
                  <small>{t('Elf vom Turnierstart')}</small>
                </div>
              </div>
              <div className="league-progress">
                <label htmlFor="league-progress">
                  {progress.completedRounds}
                  {t(' von ')}
                  {progress.totalRounds}
                  {t(' Spieltagen abgeschlossen')}
                </label>
                <progress
                  id="league-progress"
                  value={progress.completedRounds}
                  max={progress.totalRounds}
                />
              </div>
              <p className="tournament-caption">
                {t(
                  'Aufstellung, Gegner und Spielwerte bleiben f\u00FCr dieses Turnier erhalten, auch wenn du dein Team im Builder ver\u00E4nderst.',
                )}
              </p>
            </section>
            {complete ? (
              <section
                className={`panel qualification-panel qualification-panel--${status}`}
                aria-labelledby="qualification-title"
              >
                <Check size={25} aria-hidden="true" />
                <div>
                  <p className="eyebrow">{t('LIGAPHASE BEENDET')}</p>
                  <h2 id="qualification-title">{qualification}</h2>
                  <p>
                    {t('Deine Elf beendet die Ligaphase auf Platz ')}
                    {ownRow.rank}
                    {t(' mit ')}
                    {ownRow.points}
                    {t(' ')}
                    {t('Punkten.')}
                    {t(' ')}
                    {t(
                      status === 'eliminated'
                        ? 'Damit verpasst sie die K.-o.-Runden.'
                        : 'Dein Platz in der nächsten Runde steht fest.',
                    )}
                  </p>
                  <p>
                    {t(
                      'Die K.-o.-Runden sind spielbereit. Du kannst das Turnier auch nach dem Ausscheiden deiner Elf weiterverfolgen.',
                    )}
                  </p>
                </div>
              </section>
            ) : (
              nextMatch && (
                <section className="panel next-league-match">
                  <div className="section-heading">
                    <h2>{t('N\u00E4chstes Spiel')}</h2>
                    <span className="subtle-chip">
                      {t('Spieltag ')}
                      {progress.nextRound}
                    </span>
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
                      {t(`Spieltag ${progress.nextRound} simulieren`)}
                      {t(' ')}
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                    <button
                      className="button button--secondary"
                      onClick={() => setPending('finish')}
                    >
                      {t('Restliche Ligaphase simulieren')}
                    </button>
                  </div>
                  <p className="tournament-caption">
                    {t(
                      'Ein Spieltag spielt alle 18 Begegnungen aus. Deine Tabelle bleibt dadurch auf demselben Stand wie die Ergebnisse der anderen Teams.',
                    )}
                  </p>
                </section>
              )
            )}
            {lastMatch && (
              <section className="panel last-league-match">
                <p className="eyebrow">
                  {t('DEIN LETZTES ERGEBNIS \u00B7 SPIELTAG ')}
                  {lastMatch.roundNumber}
                </p>
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
              <summary>{t('Ligatabelle und Spielplan ansehen')}</summary>
              <section className="panel league-table-panel" aria-labelledby="league-table-title">
                <div className="section-heading">
                  <h2 id="league-table-title">{t('Ligatabelle')}</h2>
                  <span className="subtle-chip">
                    {t('36 Teams \u00B7')}
                    {t(' ')}
                    {
                      tournament.matches.filter(
                        (m) => m.phase === 'league' && m.status === 'played',
                      ).length
                    }
                    {t(' ')}
                    {t('/ 144 Spiele')}
                  </span>
                </div>
                <div className="league-legend">
                  <span>{t('1\u20138 \u00B7 Achtelfinale')}</span>
                  <span>{t('9\u201324 \u00B7 Playoffs')}</span>
                  <span>{t('25\u201336 \u00B7 Aus')}</span>
                </div>
                <div
                  className="league-table-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label={t('Vollständige Ligatabelle horizontal scrollen')}
                >
                  <table aria-label={t('Ligatabelle')}>
                    <caption className="sr-only">
                      {t(complete ? 'Endstand' : 'Zwischenstand')}
                      {t(' nach ')}
                      {progress.completedRounds}
                      {t(' ')}
                      {t(
                        'Spieltagen. Sortierung: Punkte, Tordifferenz, Tore, Siege, Teilnehmer-ID.',
                      )}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">{t('Pl.')}</th>
                        <th scope="col">{t('Mannschaft')}</th>
                        <th scope="col">
                          <abbr title={t('Spiele')}>{t('Sp.')}</abbr>
                        </th>
                        <th scope="col">
                          <abbr title={t('Siege')}>{t('S')}</abbr>
                        </th>
                        <th scope="col">
                          <abbr title={t('Unentschieden')}>{t('U')}</abbr>
                        </th>
                        <th scope="col">
                          <abbr title={t('Niederlagen')}>{t('N')}</abbr>
                        </th>
                        <th scope="col">{t('Tore')}</th>
                        <th scope="col">
                          <abbr title={t('Tordifferenz')}>{t('TD')}</abbr>
                        </th>
                        <th scope="col">
                          <abbr title={t('Punkte')}>{t('Pkt.')}</abbr>
                        </th>
                        <th scope="col">{t('Zone')}</th>
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
                              {t(row.goalDifference > 0 ? '+' : '')}
                              {row.goalDifference}
                            </td>
                            <td className="league-points">{row.points}</td>
                            <td className="league-zone">
                              {t(progress.completedRounds ? qualificationText[zone] : '–')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="tournament-caption">
                  {t(
                    complete
                      ? 'Die Qualifikationsplätze sind endgültig.'
                      : 'Die Zonen zeigen den aktuellen Stand. Qualifiziert wird erst nach allen acht Spieltagen.',
                  )}
                  {t(' ')}
                  {t(
                    'Bei Punktgleichheit z\u00E4hlen Tordifferenz, Tore, Siege und zuletzt die stabile Teilnehmer-ID.',
                  )}
                </p>
              </section>
              <div className="league-fixture-grid">
                <section className="panel league-fixtures">
                  <div className="section-heading">
                    <h2>{t('Dein Spielplan')}</h2>
                    <span className="subtle-chip">{t('4 Heim \u00B7 4 Ausw\u00E4rts')}</span>
                  </div>
                  <ol className="league-match-list own-league-fixtures">
                    {ownMatches.map((match) => (
                      <li key={match.id}>
                        <p className="eyebrow">
                          {t('Spieltag ')}
                          {match.roundNumber} ·{t(' ')}
                          {t(
                            match.homeParticipantId === tournament.userParticipantId
                              ? 'Heimspiel'
                              : 'Auswärtsspiel',
                          )}
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
                    <h2>{t('Alle Begegnungen')}</h2>
                    <label className="league-round-select">
                      <span>{t('Spieltag anzeigen')}</span>
                      <select
                        value={selectedRound}
                        onChange={(event) => setSelectedRound(Number(event.target.value))}
                      >
                        {Array.from({ length: progress.totalRounds }, (_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {t('Spieltag ')}
                            {i + 1}
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
              <summary>{t('Turniercode und Spielregeln')}</summary>
              <p>
                {t('Turniercode: ')}
                <code>{tournament.seed}</code>
              </p>
              <p>
                {gameRules.tournament.totalTeams}
                {t(' Teilnehmer \u00B7')}
                {t(' ')}
                {gameRules.tournament.league.matchesPerTeam}
                {t(' verschiedene Gegner \u00B7 Sieg')}
                {t(' ')}
                {gameRules.tournament.league.winPoints}
                {t(', Remis')}
                {t(' ')}
                {gameRules.tournament.league.drawPoints}
                {t(', Niederlage')}
                {t(' ')}
                {gameRules.tournament.league.lossPoints}
                {t(
                  ' Punkte. Verschiedene Saisons desselben Vereins d\u00FCrfen teilnehmen. Die Auslosung verwendet keine UEFA-T\u00F6pfe oder L\u00E4nderbeschr\u00E4nkungen.',
                )}
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
            {t(pending === 'restart' ? 'NEUE AUSLOSUNG' : 'BIS ZUM ACHTEN SPIELTAG')}
          </p>
          <h2 id="tournament-confirm-title">
            {t(
              pending === 'restart'
                ? 'Bisheriges Turnier ersetzen?'
                : 'Restliche Ligaphase simulieren?',
            )}
          </h2>
          <p>
            {t(
              pending === 'restart'
                ? tournament?.phase === 'completed'
                  ? 'Dein abgeschlossener Turnierrückblick bleibt im Archiv erhalten. Das neue Turnier verwendet deine zuletzt gespeicherte Elf. Dein Draft bleibt erhalten.'
                  : 'Dein bisheriger Spielplan und alle Ergebnisse werden durch ein neues Turnier mit deiner zuletzt gespeicherten Elf ersetzt. Dein Draft bleibt erhalten.'
                : 'Alle noch offenen Spiele werden simuliert. Danach steht deine endgültige Ligaplatzierung fest.',
            )}
          </p>
          {pending === 'restart' && (
            <label className="match-field">
              <span>{t('Turniercode')}</span>
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
              {t('Abbrechen')}
            </button>
            <button type="submit" className="button button--primary">
              {t('Best\u00E4tigen')}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
