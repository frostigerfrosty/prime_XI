import test from 'node:test';
import assert from 'node:assert/strict';
import { getDatabase, getDevelopmentTeams } from '../src/data/index.ts';
import type { LineupSlot, PlayerSeason, PrimeTeam } from '../src/types/database.ts';

/** A test-only constraint solver, not the application's draft or simulation engine. */
function assemble(pool: PrimeTeam[], slots: LineupSlot[]): PlayerSeason[] | undefined {
  const options = new Map(slots.map((slot) => [slot.id, pool.flatMap((team) => team.players)
    .filter((player) => slot.acceptedPositions.some((position) => player.position === position
      || player.secondaryPositions.includes(position)))]));
  const teams = new Set<string>();
  const people = new Set<string>();
  const picked = new Map<string, PlayerSeason>();
  let nodes = 0;
  function visit(remaining: LineupSlot[]): boolean {
    if (!remaining.length) return true;
    if (++nodes > 100_000) throw new Error('Draft-data feasibility search exceeded its bounded node budget');
    const choices = remaining.map((slot) => ({ slot, candidates: options.get(slot.id)!
      .filter((player) => !teams.has(player.primeTeamId) && !people.has(player.personId)) }))
      .sort((a, b) => a.candidates.length - b.candidates.length);
    const { slot, candidates } = choices[0]!;
    for (const player of candidates) {
      teams.add(player.primeTeamId); people.add(player.personId); picked.set(slot.id, player);
      if (visit(remaining.filter((candidate) => candidate.id !== slot.id))) return true;
      teams.delete(player.primeTeamId); people.delete(player.personId); picked.delete(slot.id);
    }
    return false;
  }
  return visit(slots) ? slots.map((slot) => picked.get(slot.id)!) : undefined;
}

function poolForSeed(teams: PrimeTeam[], seed: number): PrimeTeam[] {
  // Fixed fixture generator. No random behavior is added to the application data.
  let state = seed >>> 0;
  const shuffled = [...teams];
  for (let index = shuffled.length - 1; index > 0; index--) {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    const other = (state >>> 0) % (index + 1);
    [shuffled[index], shuffled[other]] = [shuffled[other]!, shuffled[index]!];
  }
  return shuffled.slice(0, 12);
}

test('200 reproducible draft pools each support eleven valid picks without duplicate people or source teams', () => {
  const teams = getDevelopmentTeams();
  const slots = getDatabase().formations.find((formation) => formation.id === '4-3-3')!.slots;
  for (let seed = 1; seed <= 200; seed++) {
    const pool = poolForSeed(teams, seed);
    assert.equal(new Set(pool.map((team) => team.id)).size, 12);
    const lineup = assemble(pool, slots);
    assert.ok(lineup, `No valid XI for fixture seed ${seed}`);
    assert.equal(lineup.length, 11);
    assert.equal(new Set(lineup.map((player) => player.personId)).size, 11);
    assert.equal(new Set(lineup.map((player) => player.primeTeamId)).size, 11);
    assert.equal(lineup.filter((player) => player.position === 'GK').length, 1);
  }
});

test('a pool dominated by repeated clubs and shared player identities is still usable', () => {
  const teams = getDevelopmentTeams();
  const pool = [
    ...teams.filter((team) => team.clubId === 'real-madrid'),
    ...teams.filter((team) => team.clubId === 'manchester-united'),
  ].slice(0, 12);
  const slots = getDatabase().formations.find((formation) => formation.id === '4-3-3')!.slots;
  assert.equal(pool.length, 12);
  assert.ok(assemble(pool, slots));
});

test('the feasibility check rejects twelve copies of a single source team', () => {
  const team = getDevelopmentTeams()[0]!;
  const slots = getDatabase().formations.find((formation) => formation.id === '4-3-3')!.slots;
  assert.equal(assemble(Array.from({ length: 12 }, () => team), slots), undefined);
});
