import { readFile, writeFile } from 'node:fs/promises';
import { evaluateSeasonRating } from '../src/engine/ratings.ts';

const root = new URL('../', import.meta.url);
const read = async (name) =>
  JSON.parse(await readFile(new URL(`data/editorial/${name}.json`, root), 'utf8'));
const [teams, calibration, model, people, sources] = await Promise.all(
  ['teams', 'rating-calibration', 'rating-model', 'people', 'sources'].map(read),
);
const names = new Map(people.map((person) => [person.id, person.name]));
const sourceMap = new Map(sources.map((source) => [source.id, source]));
if (Object.keys(calibration.teams).length !== teams.length)
  throw new Error('Every season requires an explicit assessment.');
const results = [];
for (const team of teams) {
  const profiles = calibration.teams[team.id];
  if (
    !profiles ||
    Object.keys(profiles).length !== team.players.length ||
    Object.keys(profiles).some((id) => !team.players.some((player) => player.personId === id))
  )
    throw new Error(`${team.id}: incomplete season assessment`);
  for (const player of team.players) {
    const id = `${team.id}:${player.personId}`;
    const profileId = profiles[player.personId];
    const profile = calibration.profiles[profileId];
    if (!profile) throw new Error(`Missing profile for ${id}`);
    const override = calibration.overrides[id] ?? {};
    const assessment = {
      profileId,
      scores: structuredClone(override.scores ?? profile.scores),
      rationale: override.rationale ?? profile.rationale,
      confidence:
        override.confidence ?? (calibration.limitedEvidenceCards[id] ? 'limited' : 'editorial'),
      sourceIds: override.sourceIds ?? [`reference-${team.id}`],
      historicalException: override.historicalException ?? null,
    };
    if (assessment.confidence === 'limited')
      assessment.rationale +=
        ' Die leistungsbezogene Einzelprüfung dieser Karte ist noch begrenzt; deshalb bleibt die Einordnung vorläufig.';
    for (const sourceId of assessment.sourceIds) {
      const source = sourceMap.get(sourceId);
      if (!source || source.accessStatus !== 'retrieved')
        throw new Error(`${id}: unread reference ${sourceId}`);
    }
    const evaluation = evaluateSeasonRating(assessment, model.rubric);
    const previous = player.rating;
    // Preserve the existing individual skill shape; technical attributes remain editorial game values.
    const delta = evaluation.rating - previous;
    for (const key of Object.keys(player.attributes))
      if (typeof player.attributes[key] === 'number')
        player.attributes[key] = Math.max(0, Math.min(99, player.attributes[key] + delta));
    player.attributes.overall = evaluation.rating;
    player.attributes.goalkeeping = player.position === 'GK' ? evaluation.rating : null;
    player.rating = evaluation.rating;
    player.ratingStatus = 'provisional';
    player.ratingAssessment = assessment;
    results.push({
      id,
      name: names.get(player.personId),
      position: player.position,
      rating: player.rating,
      weighted: evaluation.weighted,
      confidence: assessment.confidence,
      historicalException: Boolean(assessment.historicalException),
    });
  }
}
const cards = new Set(results.map((row) => row.id));
for (const id of Object.keys(calibration.overrides))
  if (!cards.has(id)) throw new Error(`Unused individual review ${id}`);
for (const id of Object.keys(calibration.limitedEvidenceCards))
  if (!cards.has(id)) throw new Error(`Unused evidence limitation ${id}`);
const benchmarks = calibration.benchmarks.map((benchmark) => {
  for (const id of benchmark.sourceIds)
    if (sourceMap.get(id)?.accessStatus !== 'retrieved')
      throw new Error(`Unread benchmark source ${id}`);
  return {
    id: benchmark.id,
    season: benchmark.season,
    ...evaluateSeasonRating(
      { ...benchmark, profileId: 'benchmark-99', confidence: 'reference' },
      model.rubric,
    ),
  };
});
const output = `${JSON.stringify(teams, null, 2)}\n`;
if (process.argv.includes('--check')) {
  if ((await readFile(new URL('data/editorial/teams.json', root), 'utf8')) !== output)
    throw new Error('Editorial ratings do not match their assessments. Run npm run ratings:build.');
} else await writeFile(new URL('data/editorial/teams.json', root), output);
if (process.argv.includes('--report'))
  console.log(
    JSON.stringify(
      {
        model: model.id,
        benchmarks,
        cards: results.length,
        average:
          Math.round((results.reduce((sum, p) => sum + p.rating, 0) / results.length) * 100) / 100,
        distribution: model.rubric.bands.map((band, index) => ({
          label: band.label,
          minimum: band.minimum,
          maximum: index ? model.rubric.bands[index - 1].minimum - 1 : 99,
          cards: results.filter(
            (p) =>
              p.rating >= band.minimum &&
              (!index || p.rating < model.rubric.bands[index - 1].minimum),
          ).length,
        })),
        below75: results.filter((p) => p.rating < 75).length,
        highest: results.filter((p) => p.rating >= 95).sort((a, b) => b.rating - a.rating),
      },
      null,
      2,
    ),
  );
