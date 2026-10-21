import type {
  TournamentParticipant,
  TournamentRound,
  TournamentState,
} from '../types/application.ts';
import type { GameRules } from '../types/database.ts';

export const roundLabels: Record<TournamentRound, string> = {
  playoffs: 'Playoffs',
  'round-of-16': 'Achtelfinale',
  'quarter-finals': 'Viertelfinale',
  'semi-finals': 'Halbfinale',
  final: 'Finale',
};
export function participantIdentity(participant: TournamentParticipant) {
  return participant.kind === 'user'
    ? { name: participant.team.name, detail: 'Deine Elf', clubId: null }
    : {
        name: participant.team.clubName,
        detail: participant.team.season,
        clubId: participant.team.clubId,
      };
}
export function userTournamentStatus(
  state: TournamentState,
  league: GameRules['tournament']['league'],
): string {
  if (state.championParticipantId === state.userParticipantId) return 'Du bist Turniersieger!';
  const lost = state.knockoutTies.find(
    (tie) =>
      (tie.teamAId === state.userParticipantId || tie.teamBId === state.userParticipantId) &&
      tie.winnerParticipantId &&
      tie.winnerParticipantId !== state.userParticipantId,
  );
  if (lost)
    return lost.round === 'final'
      ? 'Finalist · Im Finale ausgeschieden'
      : lost.round === 'playoffs'
        ? 'In den Playoffs ausgeschieden'
        : `Im ${roundLabels[lost.round]} ausgeschieden`;
  const rank = state.standings.find((row) => row.participantId === state.userParticipantId)?.rank;
  if (rank && rank >= league.eliminatedRanks[0]) return 'Nach der Ligaphase ausgeschieden';
  if (
    rank &&
    rank <= league.directQualificationRanks[1] &&
    (state.phase === 'league' || state.phase === 'playoffs')
  )
    return 'Direkt im Achtelfinale · Du überspringst die Playoffs';
  return state.phase === 'league'
    ? 'Für die Playoffs qualifiziert'
    : state.phase === 'playoffs'
      ? 'Deine Elf steht in den Playoffs'
      : `Deine Elf ist im ${roundLabels[state.phase as TournamentRound] ?? 'Turnier'}`;
}
