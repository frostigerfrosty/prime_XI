import type { DraftState } from '../types/application.ts';
import type {
  Formation,
  FormationId,
  GameRules,
  LineupSlot,
  PlayerSeason,
  PrimeTeam,
} from '../types/database.ts';
import { seededRandom, shuffled } from './random.ts';

export interface BuilderCatalog {
  teams: PrimeTeam[];
  formations: Formation[];
  tacticIds: string[];
  rules: GameRules['builder'];
  defaultTactic: string;
}

export type BuilderAction =
  | { type: 'player'; slotId: string; cardId: string }
  | { type: 'remove'; slotId: string }
  | { type: 'coach'; cardId: string | null }
  | { type: 'captain'; personId: string }
  | { type: 'formation'; formationId: FormationId }
  | { type: 'tactic'; tacticId: string };

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 200;
const date = (value: unknown): value is string => text(value) && Number.isFinite(Date.parse(value));
export const fitsSlot = (player: PlayerSeason, slot: LineupSlot): boolean =>
  slot.acceptedPositions.some(
    (position) => player.position === position || player.secondaryPositions.includes(position),
  );

/** All rules and transitions are independent of React and browser storage. */
export function createBuilder(catalog: BuilderCatalog) {
  const { rules } = catalog;
  const formationMap = new Map(catalog.formations.map((formation) => [formation.id, formation]));
  const knownPositions = new Set(
    catalog.formations.flatMap((formation) =>
      formation.slots.flatMap((slot) => slot.acceptedPositions),
    ),
  );
  const eligible = catalog.teams.filter(
    (team) =>
      team.rosterScope === 'curated_squad' &&
      team.players.length >= 18 &&
      team.coach?.primeTeamId === team.id &&
      new Set(team.players.map((player) => player.personId)).size === team.players.length &&
      team.players.every(
        (player) =>
          player.primeTeamId === team.id &&
          text(player.id) &&
          text(player.personId) &&
          Number.isInteger(player.rating) &&
          player.rating >= 0 &&
          player.rating <= 99 &&
          knownPositions.has(player.position),
      ),
  );
  if (new Set(eligible.map((team) => team.id)).size !== eligible.length)
    throw new Error('Der Teamkatalog enthält doppelte Teams.');
  const teamMap = new Map(eligible.map((team) => [team.id, team]));
  const cardMap = new Map(
    eligible.flatMap((team) => team.players.map((player) => [player.id, player] as const)),
  );
  const coachMap = new Map(
    eligible.flatMap((team) => (team.coach ? [[team.coach.id, team.coach] as const] : [])),
  );

  function lineup(draft: DraftState) {
    return draft.picks.map((pick) => ({
      slotId: pick.slotId,
      player: cardMap.get(pick.playerCardId)!,
    }));
  }

  /** An incomplete draft is valid. A complete lineup is a separate condition. */
  function isValid(value: unknown): value is DraftState {
    if (
      !record(value) ||
      !text(value['id']) ||
      !text(value['seed']) ||
      !date(value['createdAt']) ||
      !date(value['updatedAt']) ||
      Date.parse(value['updatedAt']) < Date.parse(value['createdAt']) ||
      !Array.isArray(value['drawnPrimeTeamIds']) ||
      value['drawnPrimeTeamIds'].length !== rules.drawSize ||
      !value['drawnPrimeTeamIds'].every((id) => text(id) && teamMap.has(id)) ||
      new Set(value['drawnPrimeTeamIds']).size !== rules.drawSize ||
      !text(value['formationId']) ||
      !formationMap.has(value['formationId'] as FormationId) ||
      !text(value['tacticId']) ||
      !catalog.tacticIds.includes(value['tacticId']) ||
      !Array.isArray(value['picks']) ||
      value['picks'].length > rules.playersRequired ||
      !(value['coachCardId'] === null || text(value['coachCardId'])) ||
      !(value['captainPersonId'] === null || text(value['captainPersonId']))
    )
      return false;
    const slots = formationMap.get(value['formationId'] as FormationId)!.slots;
    const people = new Set<string>();
    const occupied = new Set<string>();
    const sourceCounts = new Map<string, number>();
    for (const pick of value['picks']) {
      if (!record(pick) || !text(pick['slotId']) || !text(pick['playerCardId'])) return false;
      const player = cardMap.get(pick['playerCardId']);
      const slot = slots.find((candidate) => candidate.id === pick['slotId']);
      if (
        !player ||
        !slot ||
        !fitsSlot(player, slot) ||
        occupied.has(slot.id) ||
        people.has(player.personId) ||
        !value['drawnPrimeTeamIds'].includes(player.primeTeamId)
      )
        return false;
      const sourceCount = (sourceCounts.get(player.primeTeamId) ?? 0) + 1;
      if (sourceCount > rules.maxPlayersPerPrimeTeam) return false;
      occupied.add(slot.id);
      people.add(player.personId);
      sourceCounts.set(player.primeTeamId, sourceCount);
    }
    if (value['captainPersonId'] !== null && !people.has(value['captainPersonId'])) return false;
    const coach = value['coachCardId'] === null ? null : coachMap.get(value['coachCardId']);
    return (
      value['coachCardId'] === null ||
      Boolean(coach && value['drawnPrimeTeamIds'].includes(coach.primeTeamId))
    );
  }

  /** Bounded MRV search proves that a pool/pick still permits a legal XI. */
  function completion(draft: DraftState): DraftState['picks'] | null {
    const formation = formationMap.get(draft.formationId);
    if (!formation) return null;
    const pool = draft.drawnPrimeTeamIds.flatMap((id) => teamMap.get(id)?.players ?? []);
    const choices = new Map(
      formation.slots.map((slot) => [slot.id, pool.filter((player) => fitsSlot(player, slot))]),
    );
    const picked = new Map(
      draft.picks.map((pick) => [pick.slotId, cardMap.get(pick.playerCardId)!]),
    );
    const people = new Set([...picked.values()].map((player) => player.personId));
    const counts = new Map<string, number>();
    for (const player of picked.values())
      counts.set(player.primeTeamId, (counts.get(player.primeTeamId) ?? 0) + 1);
    let budget = 25_000;
    function visit(remaining: LineupSlot[]): boolean {
      if (!remaining.length) return true;
      if (--budget < 0) return false;
      const options = remaining
        .map((slot) => ({
          slot,
          players: choices
            .get(slot.id)!
            .filter(
              (player) =>
                !people.has(player.personId) &&
                (counts.get(player.primeTeamId) ?? 0) < rules.maxPlayersPerPrimeTeam,
            ),
        }))
        .sort((a, b) => a.players.length - b.players.length);
      const next = options[0]!;
      for (const player of next.players) {
        picked.set(next.slot.id, player);
        people.add(player.personId);
        counts.set(player.primeTeamId, (counts.get(player.primeTeamId) ?? 0) + 1);
        if (visit(remaining.filter((slot) => slot.id !== next.slot.id))) return true;
        picked.delete(next.slot.id);
        people.delete(player.personId);
        counts.set(player.primeTeamId, counts.get(player.primeTeamId)! - 1);
        if (budget < 0) break;
      }
      return false;
    }
    return visit(formation.slots.filter((slot) => !picked.has(slot.id)))
      ? formation.slots.map((slot) => ({ slotId: slot.id, playerCardId: picked.get(slot.id)!.id }))
      : null;
  }

  function newDraft(
    seed: string,
    formationId: FormationId,
    now = new Date().toISOString(),
  ): DraftState {
    if (!text(seed) || seed.length > 100 || !date(now) || !formationMap.has(formationId))
      throw new Error('Ungültige Angaben für den Draft.');
    if (eligible.length < rules.drawSize)
      throw new Error(
        `Für einen Draft werden mindestens ${rules.drawSize} gültige Teams benötigt.`,
      );
    const random = seededRandom(seed);
    for (let attempt = 0; attempt < 64; attempt++) {
      const draft: DraftState = {
        id: `draft-${seed}`,
        seed,
        createdAt: now,
        updatedAt: now,
        drawnPrimeTeamIds: shuffled(eligible, random)
          .slice(0, rules.drawSize)
          .map((team) => team.id),
        formationId,
        tacticId: catalog.defaultTactic,
        picks: [],
        coachCardId: null,
        captainPersonId: null,
      };
      if (completion(draft)) return draft;
    }
    throw new Error(
      'Für diese Formation konnte kein vervollständigbarer Draft gezogen werden. Bitte wähle eine andere Formation.',
    );
  }

  function playerIssue(draft: DraftState, slotId: string, cardId: string): string | null {
    const player = cardMap.get(cardId);
    const slot = formationMap
      .get(draft.formationId)
      ?.slots.find((candidate) => candidate.id === slotId);
    if (!player || !draft.drawnPrimeTeamIds.includes(player.primeTeamId))
      return 'Dieser Spieler gehört nicht zu deinem Draft.';
    if (!slot || !fitsSlot(player, slot)) return 'Für diese Position nicht geeignet.';
    const others = draft.picks
      .filter((pick) => pick.slotId !== slotId)
      .map((pick) => cardMap.get(pick.playerCardId)!);
    if (others.some((pick) => pick.personId === player.personId))
      return 'Dieser Spieler ist bereits in deiner Elf – auch über andere Saisons hinweg.';
    if (
      others.filter((pick) => pick.primeTeamId === player.primeTeamId).length >=
      rules.maxPlayersPerPrimeTeam
    )
      return 'Aus diesem Saisonteam ist bereits ein Spieler gewählt.';
    const next = {
      ...draft,
      picks: [
        ...draft.picks.filter((pick) => pick.slotId !== slotId),
        { slotId, playerCardId: cardId },
      ],
    };
    return completion(next)
      ? null
      : 'Mit diesem Pick wären die übrigen Positionen nicht mehr vollständig besetzbar.';
  }

  function withCaptain(draft: DraftState): DraftState {
    const players = lineup(draft).map((pick) => pick.player);
    if (players.some((player) => player.personId === draft.captainPersonId)) return draft;
    return {
      ...draft,
      captainPersonId: players.find((player) => player.naturalCaptain)?.personId ?? null,
    };
  }

  function change(
    draft: DraftState,
    action: BuilderAction,
    now = new Date().toISOString(),
  ): DraftState {
    if (!isValid(draft)) throw new Error('Der Draft ist ungültig und kann nicht geändert werden.');
    let next = structuredClone(draft);
    switch (action.type) {
      case 'player': {
        const issue = playerIssue(draft, action.slotId, action.cardId);
        if (issue) throw new Error(issue);
        next.picks = [
          ...next.picks.filter((pick) => pick.slotId !== action.slotId),
          { slotId: action.slotId, playerCardId: action.cardId },
        ];
        break;
      }
      case 'remove':
        next.picks = next.picks.filter((pick) => pick.slotId !== action.slotId);
        break;
      case 'coach':
        next.coachCardId = action.cardId;
        break;
      case 'captain':
        next.captainPersonId = action.personId;
        break;
      case 'tactic':
        next.tacticId = action.tacticId;
        break;
      case 'formation': {
        const formation = formationMap.get(action.formationId);
        if (!formation) throw new Error('Diese Formation ist nicht verfügbar.');
        // Maximum bipartite matching keeps as many current players as possible.
        const assigned = new Map<string, DraftState['picks'][number]>();
        function place(pick: DraftState['picks'][number], visited: Set<string>): boolean {
          const player = cardMap.get(pick.playerCardId)!;
          const options = formation!.slots
            .filter((slot) => fitsSlot(player, slot))
            .toSorted((a, b) => Number(b.id === pick.slotId) - Number(a.id === pick.slotId));
          for (const slot of options) {
            if (visited.has(slot.id)) continue;
            visited.add(slot.id);
            const current = assigned.get(slot.id);
            if (!current || place(current, visited)) {
              assigned.set(slot.id, pick);
              return true;
            }
          }
          return false;
        }
        for (const pick of draft.picks) place(pick, new Set());
        next.formationId = formation.id;
        next.picks = [...assigned].map(([slotId, pick]) => ({
          slotId,
          playerCardId: pick.playerCardId,
        }));
        if (!completion(next))
          throw new Error(
            'Diese Formation lässt sich mit deinem Pool und deiner Auswahl nicht vervollständigen. Entferne zuerst einzelne Spieler oder starte einen neuen Draft.',
          );
        break;
      }
    }
    if (action.type !== 'captain') next = withCaptain(next);
    next.updatedAt = now;
    if (!isValid(next)) throw new Error('Diese Auswahl ist nicht erlaubt.');
    return next;
  }

  function status(draft: DraftState) {
    const valid = isValid(draft);
    const players = valid ? lineup(draft).map((pick) => pick.player) : [];
    return {
      valid,
      complete:
        valid &&
        players.length === rules.playersRequired &&
        draft.coachCardId !== null &&
        draft.captainPersonId !== null,
      players: players.length,
      averageRating: players.length
        ? Math.round(
            (players.reduce((sum, player) => sum + player.rating, 0) / players.length) * 10,
          ) / 10
        : null,
    };
  }

  return {
    newDraft,
    change,
    isValid,
    completion,
    playerIssue,
    lineup,
    status,
    team: (id: string) => teamMap.get(id),
    player: (id: string) => cardMap.get(id),
    coach: (id: string) => coachMap.get(id),
  };
}

export type Builder = ReturnType<typeof createBuilder>;
