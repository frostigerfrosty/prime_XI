import { Shield } from 'lucide-react';
import type { ScheduledMatch, TournamentParticipant } from '../types/application.ts';
import { getClubBadgePath } from '../data/index.ts';
import { participantIdentity } from '../utils/tournament-display.ts';
import { ClubBadge } from './ui.tsx';

export function TeamName({ participant }: { participant: TournamentParticipant }) {
  const team = participantIdentity(participant);
  return (
    <span className="tournament-team-name">
      {team.clubId && getClubBadgePath(team.clubId) ? (
        <ClubBadge clubId={team.clubId} />
      ) : (
        <Shield size={27} aria-hidden="true" />
      )}
      <span>
        <strong>{team.name}</strong>
        <small>{team.detail}</small>
      </span>
    </span>
  );
}
export function MatchRow({
  match,
  participants,
  userId,
}: {
  match: ScheduledMatch;
  participants: Map<string, TournamentParticipant>;
  userId: string;
}) {
  const own = match.homeParticipantId === userId || match.awayParticipantId === userId;
  const result = match.status === 'played' ? match.result : null;
  const score = result?.afterExtraTime ?? result?.regularTime;
  return (
    <li className={`league-match ${own ? 'league-match--own' : ''}`}>
      <TeamName participant={participants.get(match.homeParticipantId)!} />
      <span className="league-match-score">
        <strong>{score ? `${score.home} : ${score.away}` : '– : –'}</strong>
        <small>{result ? (result.afterExtraTime ? '120 Min.' : '90 Min.') : 'Offen'}</small>
      </span>
      <TeamName participant={participants.get(match.awayParticipantId)!} />
    </li>
  );
}
