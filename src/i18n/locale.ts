export const languages = [
  { id: 'de', name: 'Deutsch' },
  { id: 'en', name: 'English' },
  { id: 'it', name: 'Italiano' },
] as const;
export type Language = (typeof languages)[number]['id'];
export const isLanguage = (value: unknown): value is Language =>
  languages.some((item) => item.id === value);
let language: Language = 'de';
let requestSequence = 0;
const listeners = new Set<() => void>();
export const getLanguage = () => language;
export const getIntlLocale = () => ({ de: 'de-DE', en: 'en-GB', it: 'it-IT' })[language];
export const subscribeLanguage = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
type Template = { pattern: RegExp; translated: string; slots: string[]; localizedSlots: number[] };
// Only semantic UI labels are translated inside placeholders; names and codes stay literal.
const localizedSlots: Record<string, number[]> = {
  'Im {0} ausgeschieden': [0],
  'Deine Elf ist im {0}': [0],
  '{0} von 11 Spielern passen zum Stil „{1}“.': [1],
  '{0}: {1}, {2} % Stilpassung · Coach-Rating {3} / {4}.': [1],
  '{0} / 11 Spieler · {1} · {2}': [1],
  '{0} / {1} Spieltage · {2} Punkte{3}': [3],
  '{0} auslosen': [0],
  '{0} ausgelost.': [0],
  '{0}: {1} simuliert.': [0, 1],
  '{0}: {1} simulieren': [0, 1],
};
const dictionaries: Partial<Record<Language, Record<string, string>>> = {};
const templates: Partial<Record<Language, Template[]>> = {};
const loads: Partial<Record<Language, Promise<void>>> = {};
const escape = (value: string) =>
  Array.from(value)
    .map((char) => ('\\^$.*+?()[]{}|'.includes(char) ? '\\' + char : char))
    .join('');
async function loadLanguage(next: 'en' | 'it') {
  const result =
    next === 'en'
      ? await import('./en.json', { with: { type: 'json' } })
      : await import('./it.json', { with: { type: 'json' } });
  const entries: Record<string, string> = result.default;
  dictionaries[next] = entries;
  templates[next] = Object.entries(entries)
    .filter(([key]) => /\{\d+\}/u.test(key) && key.replace(/\{\d+\}/gu, '').trim().length > 2)
    .sort(([a], [b]) => b.length - a.length)
    .map(([key, translated]) => {
      const slots: string[] = [];
      const expression = key
        .split(/(\{\d+\})/u)
        .map((part) => {
          if (/^\{\d+\}$/u.test(part)) {
            slots.push(part);
            return '(.*?)';
          }
          return escape(part);
        })
        .join('');
      return {
        pattern: new RegExp('^' + expression + '$', 'u'),
        translated,
        slots,
        localizedSlots: localizedSlots[key] ?? [],
      };
    });
}
export async function setLanguage(next: Language): Promise<void> {
  if (!isLanguage(next)) throw new Error('Unsupported language');
  const sequence = ++requestSequence;
  if (next !== 'de' && !dictionaries[next]) {
    loads[next] ??= loadLanguage(next).catch((error) => {
      delete loads[next];
      throw error;
    });
    await loads[next];
  }
  if (sequence !== requestSequence) return;
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  if (language === next) return;
  language = next;
  for (const listener of listeners) listener();
}
export function t(source: string): string {
  if (language === 'de' || !source) return source;
  const entries = dictionaries[language] ?? {};
  const normalized = source.trim().replace(/\s+/gu, ' ');
  if (!normalized) return source;
  const lookup = (key: string) => (Object.hasOwn(entries, key) ? entries[key] : undefined);
  const leading = source.match(/^\s*/u)?.[0] ?? '';
  const trailing = source.match(/\s*$/u)?.[0] ?? '';
  if (lookup(normalized) !== undefined) return leading + lookup(normalized) + trailing;
  for (const entry of templates[language] ?? []) {
    const match = entry.pattern.exec(normalized);
    if (match)
      return (
        leading +
        entry.translated.replace(/\{\d+\}/gu, (slot) => {
          const captured = match[entry.slots.indexOf(slot) + 1] ?? slot;
          return entry.localizedSlots.includes(entry.slots.indexOf(slot)) ? t(captured) : captured;
        }) +
        trailing
      );
  }
  return source
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => lookup(sentence.trim()) ?? sentence)
    .join(' ');
}
