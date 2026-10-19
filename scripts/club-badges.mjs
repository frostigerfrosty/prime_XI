const escapeXml = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');

/** Original, deliberately simple monograms. No official crest or third-party image. */
export function renderClubBadge(club) {
  const hex = club.colors.primary.slice(1);
  const rgb = [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const luminance = rgb.reduce((sum, channel, i) => sum + channel * [0.2126, 0.7152, 0.0722][i], 0);
  const textColor = luminance > 0.55 ? '#101827' : '#FFFFFF';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" role="img" aria-label="${escapeXml(club.name)} – eigenes Vereinsmonogramm"><rect x="3" y="3" width="74" height="74" rx="18" fill="${club.colors.primary}" stroke="#64748B" stroke-width="2"/><path d="M16 63h48" stroke="${club.colors.secondary}" stroke-width="5" stroke-linecap="round"/><text x="40" y="45" text-anchor="middle" font-family="Arial,sans-serif" font-size="21" font-weight="700" fill="${textColor}">${escapeXml(club.shortName)}</text></svg>\n`;
}
