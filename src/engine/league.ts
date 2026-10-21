import type { LeagueTableRow, ScheduledMatch } from '../types/application.ts';
import type { GameRules } from '../types/database.ts';
import { seededRandom, shuffled } from './random.ts';

type LeagueRules = GameRules['tournament']['league'];
export type Qualification = 'direct' | 'playoff' | 'eliminated';
const orderKeys = ['points', 'goalDifference', 'goalsFor', 'wins', 'teamId'];
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function validIds(ids: readonly string[]) {
  return (
    ids.length >= 2 &&
    ids.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 200) &&
    new Set(ids).size === ids.length
  );
}

/** Eight distinct round-robin matchings; closed trails orient the even graph 4H/4A. */
export function createLeagueSchedule(
  ids: readonly string[],
  seed: string,
  rules: LeagueRules,
): ScheduledMatch[] {
  check(
    validIds(ids) && ids.length % 2 === 0 && ids.length <= 100,
    'Der Spielplan benötigt eine gerade Zahl verschiedener Teilnehmer.',
  );
  check(
    typeof seed === 'string' && seed.trim().length > 0 && seed.length <= 200,
    'Der Spielplan benötigt einen gültigen Turniercode.',
  );
  const count = rules.matchesPerTeam;
  check(
    Number.isInteger(count) &&
      count > 0 &&
      count < ids.length &&
      count % 2 === 0 &&
      rules.homeMatches === count / 2 &&
      rules.awayMatches === count / 2,
    'Die Ligaphase benötigt gleich viele Heim- und Auswärtsspiele.',
  );
  const random = seededRandom(JSON.stringify(['league-v1', seed]));
  const ring = shuffled(ids, random);
  const rounds: [string, string][][] = [];
  for (let round = 0; round < ids.length - 1; round++) {
    const pairs: [string, string][] = [];
    for (let index = 0; index < ids.length / 2; index++)
      pairs.push([ring[index]!, ring[ids.length - 1 - index]!]);
    rounds.push(pairs);
    ring.splice(1, 0, ring.pop()!);
  }
  const selected = shuffled(rounds, random).slice(0, count);
  const edges = selected.flat();
  const adjacency = new Map(ids.map((id) => [id, [] as number[]]));
  edges.forEach(([a, b], index) => {
    adjacency.get(a)!.push(index);
    adjacency.get(b)!.push(index);
  });
  for (const [id, incident] of adjacency) adjacency.set(id, shuffled(incident, random));
  const used = new Set<number>();
  const oriented = new Map<number, [string, string]>();
  for (const start of shuffled(ids, random)) {
    let current = start;
    while (true) {
      const incident = adjacency.get(current)!;
      while (incident.length && used.has(incident.at(-1)!)) incident.pop();
      const edgeIndex = incident.pop();
      if (edgeIndex === undefined) break;
      used.add(edgeIndex);
      const [a, b] = edges[edgeIndex]!;
      const next = a === current ? b : a;
      oriented.set(edgeIndex, [current, next]);
      current = next;
    }
    check(current === start, 'Die Heim-/Auswärtsverteilung konnte nicht aufgelöst werden.');
  }
  check(used.size === edges.length, 'Der Spielplan ist unvollständig.');
  return edges.map((_, index) => ({
    id: `league-${Math.floor(index / (ids.length / 2)) + 1}-${(index % (ids.length / 2)) + 1}`,
    phase: 'league',
    roundNumber: Math.floor(index / (ids.length / 2)) + 1,
    leg: null,
    homeParticipantId: oriented.get(index)![0],
    awayParticipantId: oriented.get(index)![1],
    neutralVenue: false,
    status: 'scheduled',
    result: null,
  }));
}

/** Rebuild from played league matches; no incremental counters can drift on reload. */
export function calculateLeagueTable(
  ids: readonly string[],
  matches: readonly ScheduledMatch[],
  rules: LeagueRules,
): LeagueTableRow[] {
  check(validIds(ids), 'Ungültige Teilnehmer für die Tabelle.');
  check(
    rules.tiebreakers.length === orderKeys.length &&
      new Set(rules.tiebreakers).size === orderKeys.length &&
      rules.tiebreakers.every((key) => orderKeys.includes(key)) &&
      rules.tiebreakers[0] === 'points' &&
      rules.tiebreakers.at(-1) === 'teamId',
    'Unbekannte Tabellen-Sortierung.',
  );
  check(
    [rules.winPoints, rules.drawPoints, rules.lossPoints].every(
      (value) => Number.isSafeInteger(value) && value >= 0,
    ) &&
      rules.winPoints > rules.drawPoints &&
      rules.drawPoints >= rules.lossPoints,
    'Ungültige Punkteverteilung.',
  );
  const rows = new Map(
    ids.map((id): [string, LeagueTableRow] => [
      id,
      {
        participantId: id,
        rank: 0,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
      },
    ]),
  );
  const matchIds = new Set<string>();
  for (const match of matches) {
    if (match.phase !== 'league') continue;
    check(!matchIds.has(match.id), 'Doppeltes Ligaspiel.');
    matchIds.add(match.id);
    const h = rows.get(match.homeParticipantId),
      a = rows.get(match.awayParticipantId);
    check(h && a && h !== a, 'Ungültige Ligapaarung.');
    check(match.status === 'scheduled' || match.status === 'played', 'Unbekannter Spielstatus.');
    if (match.status === 'scheduled') {
      check(match.result === null, 'Ein geplantes Spiel darf kein Ergebnis haben.');
      continue;
    }
    const result = match.result;
    check(
      result &&
        result.afterExtraTime === null &&
        result.penalties === null &&
        [result.regularTime?.home, result.regularTime?.away].every(
          (goals) => Number.isSafeInteger(goals) && goals >= 0 && goals <= 1000,
        ),
      'Ungültiges Ligaergebnis.',
    );
    const { home, away } = result.regularTime;
    h.played++;
    a.played++;
    h.goalsFor += home;
    h.goalsAgainst += away;
    a.goalsFor += away;
    a.goalsAgainst += home;
    if (home > away) {
      h.wins++;
      a.losses++;
    } else if (home < away) {
      a.wins++;
      h.losses++;
    } else {
      h.draws++;
      a.draws++;
    }
  }
  for (const row of rows.values()) {
    row.goalDifference = row.goalsFor - row.goalsAgainst;
    row.points =
      row.wins * rules.winPoints + row.draws * rules.drawPoints + row.losses * rules.lossPoints;
  }
  const table = [...rows.values()].sort((a, b) => {
    for (const key of rules.tiebreakers) {
      if (key === 'teamId')
        return a.participantId < b.participantId ? -1 : a.participantId > b.participantId ? 1 : 0;
      const difference =
        b[key as 'points' | 'goalDifference' | 'goalsFor' | 'wins'] -
        a[key as 'points' | 'goalDifference' | 'goalsFor' | 'wins'];
      if (difference) return difference;
    }
    return 0;
  });
  return table.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function leagueQualification(rank: number, rules: LeagueRules): Qualification {
  check(Number.isInteger(rank), 'Ungültiger Tabellenplatz.');
  for (const [kind, range] of [
    ['direct', rules.directQualificationRanks],
    ['playoff', rules.playoffRanks],
    ['eliminated', rules.eliminatedRanks],
  ] as const)
    if (rank >= range[0] && rank <= range[1]) return kind;
  throw new Error('Tabellenplatz außerhalb der Ligaphase.');
}
