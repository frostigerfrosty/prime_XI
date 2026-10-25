import { getIntlLocale } from '../i18n/locale.ts';

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/u);
  return (
    (parts.length === 1
      ? parts[0]?.slice(0, 2)
      : `${parts[0]?.[0] ?? ''}${parts.at(-1)?.[0] ?? ''}`
    )?.toLocaleUpperCase('de') ?? ''
  );
}

export const formatNumber = (value: number): string => value.toLocaleString(getIntlLocale());
export const formatStrength = (value: number): string =>
  value.toLocaleString(getIntlLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
