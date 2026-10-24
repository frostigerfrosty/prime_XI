export interface MatchSetup {
  homeId: string;
  awayId: string;
  mode: 'regular' | 'knockout';
  neutralVenue: boolean;
  seed: string;
}

export interface MatchLinkVersions {
  dataset: string;
  engine: string;
  strength: string;
}

const fields = [
  'v',
  'home',
  'away',
  'mode',
  'neutral',
  'seed',
  'dataset',
  'engine',
  'strength',
] as const;

/** Empty codes remain editable in the form; they cannot be played or shared. */
export function isShareableMatchCode(seed: string): boolean {
  return seed.trim().length > 0 && seed.length <= 100 && !/[\u0000-\u001f\u007f]/u.test(seed);
}

/** Accept old pair-only links, or a complete versioned setup. Never substitute teams. */
export function readMatchSetup(
  params: URLSearchParams,
  defaults: MatchSetup,
  knownTeamIds: ReadonlySet<string>,
  versions: MatchLinkVersions,
): MatchSetup {
  const present = fields.filter((key) => params.has(key));
  if (present.some((key) => params.getAll(key).length !== 1))
    throw new Error('Der Testspiellink enthält mehrdeutige Angaben. Wähle die Begegnung neu.');
  let setup = { ...defaults };
  if (present.length) {
    const version = params.get('v');
    if (version === null) {
      if (present.length !== 2 || !params.has('home') || !params.has('away'))
        throw new Error('Der Testspiellink ist unvollständig. Wähle die Begegnung neu.');
      setup.homeId = params.get('home')!;
      setup.awayId = params.get('away')!;
    } else {
      if (version !== '1') throw new Error('Dieses Testspiellink-Format wird nicht unterstützt.');
      if (present.length !== fields.length)
        throw new Error('Der Testspiellink ist unvollständig. Wähle die Begegnung neu.');
      if (
        params.get('dataset') !== versions.dataset ||
        params.get('engine') !== versions.engine ||
        params.get('strength') !== versions.strength
      )
        throw new Error(
          'Der Link stammt aus einem anderen Katalog- oder Regelstand. Das damalige Ergebnis kann mit dieser Version nicht zuverlässig wiederholt werden. Wähle eine neue Begegnung.',
        );
      const mode = params.get('mode');
      const neutral = params.get('neutral');
      if ((mode !== 'regular' && mode !== 'knockout') || (neutral !== '1' && neutral !== '0'))
        throw new Error('Spielmodus oder Platzwahl im Testspiellink ist ungültig.');
      setup = {
        homeId: params.get('home')!,
        awayId: params.get('away')!,
        mode,
        neutralVenue: neutral === '1',
        seed: params.get('seed')!,
      };
    }
  }
  if (
    !knownTeamIds.has(setup.homeId) ||
    !knownTeamIds.has(setup.awayId) ||
    setup.homeId === setup.awayId
  )
    throw new Error(
      'Der Link benötigt zwei verschiedene verfügbare Teams. Eine eigene Elf muss in diesem Browser vorhanden sein.',
    );
  if (setup.seed.length > 100 || /[\u0000-\u001f\u007f]/u.test(setup.seed))
    throw new Error(
      'Der Spielcode im Link ist ungültig. Erlaubt sind bis zu 100 Zeichen ohne Steuerzeichen.',
    );
  return setup;
}

/** Also preserves unfinished code input while editing; sharing validates it separately. */
export function matchSetupParams(setup: MatchSetup, versions: MatchLinkVersions): URLSearchParams {
  return new URLSearchParams({
    v: '1',
    home: setup.homeId,
    away: setup.awayId,
    mode: setup.mode,
    neutral: setup.neutralVenue ? '1' : '0',
    seed: setup.seed,
    dataset: versions.dataset,
    engine: versions.engine,
    strength: versions.strength,
  });
}
