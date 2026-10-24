import { getDatasetVersion, getGameRules } from '../data/index.ts';
import { isCompatibleDraftDataset } from '../data/compatibility.ts';
import type { DraftState } from '../types/application.ts';
import type { Builder } from '../engine/builder.ts';

export const draftStorageKey = getGameRules().storage.keys.currentDraft;
type DraftStorage = Pick<Storage, 'getItem' | 'setItem'>;
export const draftStorageWarning =
  'Dein Browser erlaubt gerade keine lokale Speicherung. Dein Draft bleibt nur für diese Sitzung erhalten.';

export function readDraft(
  storage: DraftStorage,
  builder: Builder,
): { draft: DraftState | null; warning: string | null } {
  try {
    const raw = storage.getItem(draftStorageKey);
    if (!raw) return { draft: null, warning: null };
    const value: unknown = JSON.parse(raw);
    if (
      typeof value !== 'object' ||
      value === null ||
      !('schemaVersion' in value) ||
      value.schemaVersion !== 1 ||
      !('datasetVersion' in value) ||
      !isCompatibleDraftDataset(value.datasetVersion) ||
      !('draft' in value) ||
      !builder.isValid(value.draft) ||
      !builder.completion(value.draft)
    ) {
      return {
        draft: null,
        warning:
          'Der gespeicherte Draft passt nicht zum aktuellen Katalog oder ist beschädigt. Du kannst einen neuen Draft starten; andere Spielstände bleiben erhalten.',
      };
    }
    return {
      draft: value.draft,
      warning:
        value.datasetVersion === getDatasetVersion()
          ? null
          : 'Der Katalog wurde aktualisiert. Deine Auswahl bleibt erhalten; korrigierte Länderzuordnungen können die Draft-Chemie ändern. Gespeicherte Teams und laufende Turniere behalten ihre bisherigen Werte.',
    };
  } catch {
    return {
      draft: null,
      warning:
        'Dein Draft konnte nicht aus dem Browserspeicher gelesen werden. Du kannst einen neuen Draft für diese Sitzung starten.',
    };
  }
}

export function writeDraft(storage: DraftStorage, draft: DraftState, builder: Builder): boolean {
  if (!builder.isValid(draft) || !builder.completion(draft)) return false;
  try {
    storage.setItem(
      draftStorageKey,
      JSON.stringify({ schemaVersion: 1, datasetVersion: getDatasetVersion(), draft }),
    );
    return true;
  } catch {
    return false;
  }
}
