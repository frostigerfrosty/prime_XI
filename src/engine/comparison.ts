import { isRecord } from './strength.ts';

/** JSON structure, independent of property order; tolerance is for computed xG only. */
export function equalValues(a: unknown, b: unknown, tolerant = false): boolean {
  if (a === b) return true;
  if (tolerant && typeof a === 'number' && typeof b === 'number')
    return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-10;
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((item, i) => equalValues(item, b[i], tolerant));
  if (!isRecord(a) || !isRecord(b)) return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.hasOwn(b, key) && equalValues(a[key], b[key], tolerant))
  );
}

export function equalMatchResults(a: unknown, b: unknown): boolean {
  if (!isRecord(a) || !isRecord(b)) return false;
  const { expectedGoals: ax, extraTimeExpectedGoals: ae, ...ar } = a;
  const { expectedGoals: bx, extraTimeExpectedGoals: be, ...br } = b;
  return equalValues(ar, br) && equalValues(ax, bx, true) && equalValues(ae, be, true);
}
