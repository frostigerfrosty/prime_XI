import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Trophy } from 'lucide-react';
import { useTournament } from '../app/TournamentProvider.tsx';
import { gameRules, tournamentEngine } from '../app/game.ts';
import type {
  KnockoutTie,
  TournamentParticipant,
  TournamentRound,
  TournamentState,
} from '../types/application.ts';
import {
  participantIdentity,
  roundLabels,
  userTournamentStatus,
} from '../utils/tournament-display.ts';
import { MatchRow, TeamName } from './TournamentTeams.tsx';

function TieCard({
  tie,
  tournament,
  participants,
}: {
  tie: KnockoutTie;
  tournament: TournamentState;
  participants: Map<string, TournamentParticipant>;
}) {
  const matches = tie.matchIds.map((id) => tournament.matches.find((match) => match.id === id)!);
  const played = matches.some((m) => m.status === 'played');
  const last = matches.at(-1)!;
  const result = last.status === 'played' ? last.result : null;
  const winner = tie.winnerParticipantId ? participants.get(tie.winnerParticipantId)! : null;
  const own =
    tie.teamAId === tournament.userParticipantId || tie.teamBId === tournament.userParticipantId;
  return (
    <article
      className={`knockout-tie ${own ? 'knockout-tie--own' : ''}`}
      data-testid={`tie-${tie.id}`}
    >
      <div className="knockout-tie-heading">
        <span className="eyebrow">
          {tie.round === 'final'
            ? 'NEUTRALES FINALE'
            : played
              ? matches.every((m) => m.status === 'played')
                ? 'GESAMTSTAND'
                : 'NACH DEM HINSPIEL'
              : 'AUSGELOST'}
        </span>
        {own && <span className="subtle-chip">Deine Paarung</span>}
      </div>
      {(
        [
          ['teamA', tie.teamAId],
          ['teamB', tie.teamBId],
        ] as const
      ).map(([side, id]) => (
        <div
          className={`knockout-team-row ${id === tie.winnerParticipantId ? 'knockout-team-row--winner' : ''}`}
          key={id}
        >
          <TeamName participant={participants.get(id)!} />
          <strong>{played ? tie.aggregateGoals[side] : '–'}</strong>
        </div>
      ))}
      <p className="knockout-tie-decision">
        {winner
          ? `${tie.round === 'final' ? 'Turniersieger' : 'Weiter'}: ${participantIdentity(winner).name} · ${participantIdentity(winner).detail}`
          : played
            ? 'Rückspiel noch offen'
            : 'Noch kein Ergebnis'}
      </p>
      {result?.penalties && (
        <p className="knockout-penalty-score">
          Elfmeterschießen {result.penalties.home} : {result.penalties.away} · separat von den
          Gesamttoren
        </p>
      )}
      <details className="knockout-match-details">
        <summary>
          {matches.length === 1 ? 'Finalspiel ansehen' : 'Hin- und Rückspiel ansehen'}
        </summary>
        {matches.map((match) => (
          <div key={match.id}>
            <p className="eyebrow">
              {match.leg === 1 ? 'HINSPIEL' : match.leg === 2 ? 'RÜCKSPIEL' : 'FINALE'}
            </p>
            <ul className="league-match-list">
              <MatchRow
                match={match}
                participants={participants}
                userId={tournament.userParticipantId}
              />
            </ul>
            {match.status === 'played' && match.result.afterExtraTime && (
              <p className="tournament-caption">
                Nach 90 Minuten {match.result.regularTime.home} : {match.result.regularTime.away} ·
                Der angezeigte Spielstand enthält die Verlängerung.
              </p>
            )}
          </div>
        ))}
        {result?.shootoutKicks.length ? (
          <details className="match-penalties">
            <summary>Elfmeterschießen ansehen</summary>
            <p className="tournament-caption">
              Heim: {participantIdentity(participants.get(last.homeParticipantId)!).name} · Gast:{' '}
              {participantIdentity(participants.get(last.awayParticipantId)!).name}
            </p>
            <ol>
              {result.shootoutKicks.map((kick, i) => (
                <li key={i}>
                  <span>
                    {kick.round}. Runde · {kick.side === 'home' ? 'Heim' : 'Gast'}
                  </span>
                  <strong>{kick.scored ? 'Treffer' : 'Vergeben'}</strong>
                </li>
              ))}
            </ol>
          </details>
        ) : null}
      </details>
    </article>
  );
}

export function KnockoutPanel({
  tournament,
  onMessage,
  onError,
}: {
  tournament: TournamentState;
  onMessage: (message: string) => void;
  onError: (message: string) => void;
}) {
  const { knockoutAction } = useTournament();
  const info = tournamentEngine.knockoutProgress(tournament);
  const [selected, setSelected] = useState<TournamentRound>(info.round ?? 'playoffs');
  const [confirmFinish, setConfirmFinish] = useState(false);
  const panel = useRef<HTMLElement>(null),
    dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (confirmFinish) dialog.current?.showModal();
    else dialog.current?.close();
  }, [confirmFinish]);
  useEffect(() => {
    if (info.round) setSelected(info.round);
    else if (info.complete) setSelected('final');
  }, [info.round, info.complete]);
  const participants = new Map(tournament.participants.map((p) => [p.id, p]));
  const champion = tournament.championParticipantId
    ? participants.get(tournament.championParticipantId)!
    : null;
  const currentTies = tournament.knockoutTies.filter((tie) => tie.round === selected);
  function act(action: 'draw' | 'leg' | 'finish') {
    try {
      knockoutAction(action, info.token);
      onError('');
      onMessage(
        action === 'draw'
          ? `${roundLabels[info.nextRound!]} ausgelost.`
          : action === 'finish' || info.round === 'final'
            ? 'Das Turnier ist beendet. Der Sieger steht fest.'
            : `${roundLabels[info.round!]}: ${info.nextLeg === 1 ? 'Hinspiele' : 'Rückspiele'} simuliert.`,
      );
      requestAnimationFrame(() => panel.current?.focus());
    } catch (reason) {
      onError(
        reason instanceof Error ? reason.message : 'Die Runde konnte nicht simuliert werden.',
      );
    }
  }
  return (
    <section
      className="panel knockout-panel"
      id="knockout-panel"
      ref={panel}
      tabIndex={-1}
      aria-labelledby="knockout-title"
    >
      {champion ? (
        <div className="tournament-champion" data-testid="tournament-champion">
          <Trophy size={42} aria-hidden="true" />
          <p className="eyebrow">TURNIER BEENDET</p>
          <h2 id="knockout-title">{participantIdentity(champion).name}</h2>
          <p>{participantIdentity(champion).detail} · Turniersieger</p>
          <TeamName participant={champion} />
        </div>
      ) : (
        <div className="section-heading">
          <div>
            <p className="eyebrow">DIE ENTSCHEIDUNGSRUNDEN</p>
            <h2 id="knockout-title">
              {info.round ? roundLabels[info.round] : 'Dein Weg zum Finale'}
            </h2>
          </div>
          <Trophy size={24} aria-hidden="true" />
        </div>
      )}
      <p className="knockout-user-status" data-testid="knockout-user-status">
        {userTournamentStatus(tournament, gameRules.tournament.league)}
      </p>
      {!info.complete && (
        <div className="league-play-actions knockout-actions">
          {info.nextRound && (
            <button className="button button--primary" onClick={() => act('draw')}>
              {roundLabels[info.nextRound]} auslosen <ArrowRight size={16} aria-hidden="true" />
            </button>
          )}
          {info.nextLeg && info.round && (
            <button className="button button--primary" onClick={() => act('leg')}>
              {info.round === 'final'
                ? 'Finale simulieren'
                : `${roundLabels[info.round]}: ${info.nextLeg === 1 ? 'Hinspiele' : 'Rückspiele'} simulieren`}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          )}
          <button className="button button--secondary" onClick={() => setConfirmFinish(true)}>
            Bis zum Finale simulieren
          </button>
        </div>
      )}
      <p className="tournament-caption">
        Playoffs und Achtelfinale sind gesetzt; die besser platzierten Ligateams haben das Rückspiel
        zu Hause. Ab dem Viertelfinale wird frei neu ausgelost. Das Finale findet auf neutralem
        Platz statt. Keine Auswärtstorregel.
      </p>
      <div className="knockout-round-navigation" role="group" aria-label="K.-o.-Runden">
        {gameRules.tournament.knockout.rounds.map((round) => {
          const ties = tournament.knockoutTies.filter((tie) => tie.round === round.id);
          return (
            <button
              type="button"
              key={round.id}
              disabled={!ties.length}
              aria-pressed={selected === round.id && ties.length > 0}
              onClick={() => setSelected(round.id as TournamentRound)}
            >
              <strong>{roundLabels[round.id as TournamentRound]}</strong>
              <small>
                {ties.length
                  ? `${ties.filter((tie) => tie.winnerParticipantId).length} / ${ties.length} entschieden`
                  : 'Noch nicht ausgelost'}
              </small>
            </button>
          );
        })}
      </div>
      {currentTies.length > 0 && (
        <>
          <h3 className="knockout-round-title">{roundLabels[selected]} · Paarungen</h3>
          <div className="knockout-ties">
            {currentTies.map((tie) => (
              <TieCard key={tie.id} tie={tie} tournament={tournament} participants={participants} />
            ))}
          </div>
        </>
      )}
      {info.complete && (
        <p className="tournament-caption">
          Alle 189 Spiele sind abgeschlossen. Das vollständige Turnier bleibt hier gespeichert. In
          der Historie findest du zusätzlich den Rückblick mit deiner Elf und ihren Spielen.
        </p>
      )}
      <dialog
        className="builder-confirm tournament-confirm"
        ref={dialog}
        aria-labelledby="knockout-confirm-title"
        onCancel={() => setConfirmFinish(false)}
        onClose={() => setConfirmFinish(false)}
      >
        <h2 id="knockout-confirm-title">Turnier vollständig simulieren?</h2>
        <p>
          Alle noch offenen K.-o.-Runden werden ausgelost und ausgespielt. Danach steht der
          Turniersieger fest. Bereits gespielte Ergebnisse bleiben erhalten.
        </p>
        <div>
          <button className="button button--secondary" onClick={() => setConfirmFinish(false)}>
            Abbrechen
          </button>
          <button
            className="button button--primary"
            onClick={() => {
              setConfirmFinish(false);
              act('finish');
            }}
          >
            Bestätigen
          </button>
        </div>
      </dialog>
    </section>
  );
}
