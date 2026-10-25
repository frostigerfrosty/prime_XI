import { getDatasetVersion } from './index.ts';

/** Known rating/nationality updates preserve card, coach and position identities. */
export function isCompatibleDraftDataset(version: unknown): boolean {
  const current = getDatasetVersion();
  return (
    version === current ||
    (current === '0.2.1' && version === '0.2.0') ||
    (current === '0.3.0' && (version === '0.2.0' || version === '0.2.1'))
  );
}
