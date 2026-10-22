import type { Database } from '../types/database.ts';

/** This is a transport/shape guard; the complete data is validated before every build. */
export async function loadCatalog(url: string, fetcher: typeof fetch = fetch): Promise<Database> {
  const response = await fetcher(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok)
    throw new Error(`Der Katalog konnte nicht geladen werden (${response.status}).`);
  const value: unknown = await response.json();
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('Der geladene Katalog hat ein unbekanntes Format.');
  const data = value as Record<string, unknown>;
  if (
    data['schemaVersion'] !== 2 ||
    typeof data['datasetVersion'] !== 'string' ||
    ![
      'teams',
      'people',
      'clubs',
      'formations',
      'sources',
      'coverage',
      'tasks',
      'positions',
      'countries',
      'tactics',
      'targetYears',
    ].every((key) => Array.isArray(data[key])) ||
    !['rules', 'defaults', 'ratingModel'].every(
      (key) => typeof data[key] === 'object' && data[key] !== null && !Array.isArray(data[key]),
    )
  )
    throw new Error('Der geladene Katalog ist unvollständig oder nicht kompatibel.');
  return value as Database;
}
