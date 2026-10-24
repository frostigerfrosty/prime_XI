import { getDatasetVersion } from './index.ts';

/** 0.2.1 only corrects three nationalities; all draft/card/coach identities and positions stay valid. */
export function isCompatibleDraftDataset(version: unknown): boolean {
  const current = getDatasetVersion();
  return version === current || (current === '0.2.1' && version === '0.2.0');
}
