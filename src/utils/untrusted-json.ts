/** Bounds apply before recursive game validation; JSON remains untrusted local input. */
export const jsonLimits = {
  depth: 32,
  nodes: 250_000,
  collection: 10_000,
  settings: 16_384,
  draft: 131_072,
  team: 262_144,
  tournament: 4_000_000,
  snapshot: 12_000_000,
} as const;

export function parseUntrustedJson(raw: string, maximumLength: number): unknown {
  if (raw.length > maximumLength) throw new Error('JSON size limit exceeded.');
  const value: unknown = JSON.parse(raw);
  const pending = [{ value, depth: 0 }];
  let nodes = 0;
  while (pending.length) {
    const current = pending.pop()!;
    if (++nodes > jsonLimits.nodes || current.depth > jsonLimits.depth)
      throw new Error('JSON complexity limit exceeded.');
    if (typeof current.value === 'number' && !Number.isFinite(current.value))
      throw new Error('Invalid JSON number.');
    if (typeof current.value !== 'object' || current.value === null) continue;
    const keys = Object.keys(current.value);
    if (keys.length > jsonLimits.collection) throw new Error('JSON collection limit exceeded.');
    for (const key of keys) {
      if (key === '__proto__' || key === 'prototype' || key === 'constructor')
        throw new Error('Unsafe JSON property.');
      pending.push({
        value: (current.value as Record<string, unknown>)[key],
        depth: current.depth + 1,
      });
    }
  }
  return value;
}
