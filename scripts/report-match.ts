import { getGameRules } from '../src/data/index.ts';
import { createMatchEngine } from '../src/engine/match.ts';

const engine = createMatchEngine(getGameRules());
const count = 100_000;
console.log(
  `Engine ${engine.engineVersion} · ${count.toLocaleString('de')} neutrale Spiele pro Paar · report-0…${count - 1}`,
);
console.log('A/B       Sieg A 90   Remis 90   Sieg B 90   Sieg A K.-o.');
for (const [h, a] of [
  [94, 87],
  [94, 93],
  [82, 91],
  [90, 90],
]) {
  let home = 0,
    draw = 0,
    away = 0,
    knockoutHome = 0;
  for (let index = 0; index < count; index++) {
    const result = engine.simulateMatch(
      { id: 'h', strength: h! },
      { id: 'a', strength: a! },
      {
        seed: `report-${index}`,
        mode: 'knockout',
        neutralVenue: true,
      },
    );
    if (result.regularTime.home > result.regularTime.away) home++;
    else if (result.regularTime.home === result.regularTime.away) draw++;
    else away++;
    if (result.winnerParticipantId === 'h') knockoutHome++;
  }
  const percent = (value: number) => `${((100 * value) / count).toFixed(2)} %`.padStart(10);
  console.log(`${h}/${a}   ${[home, draw, away, knockoutHome].map(percent).join(' ')}`);
}
console.log('K.-o.: 90 Minuten + ggf. 30 Minuten Verlängerung und Elfmeterschießen.');
console.log(
  'Kein bedingter Sieganteil: Remis stehen als eigene 90-Minuten-Ergebnisse in der Tabelle.',
);
