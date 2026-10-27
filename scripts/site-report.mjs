import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Explicit CLI outputs are intentional; the default must not share a predictable temp path. */
export async function siteReportPath(explicitPath) {
  if (explicitPath !== undefined) return explicitPath;
  const directory = await mkdtemp(join(tmpdir(), 'prime-xi-site-check-'));
  return join(directory, 'report.json');
}
