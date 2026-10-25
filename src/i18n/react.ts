import { useSyncExternalStore } from 'react';
import { getLanguage, subscribeLanguage } from './locale.ts';
export { t } from './locale.ts';
export function useLanguage() {
  return useSyncExternalStore(subscribeLanguage, getLanguage, () => 'de' as const);
}
