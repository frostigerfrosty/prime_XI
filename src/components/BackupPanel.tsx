import { getIntlLocale, languages } from '../i18n/locale.ts';
import { t, useLanguage } from '../i18n/react.ts';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Download, Upload } from 'lucide-react';
import { useDraft } from '../app/DraftProvider.tsx';
import { useTournament } from '../app/TournamentProvider.tsx';
import { useHistory } from '../app/HistoryProvider.tsx';
import { useSettings } from '../app/SettingsProvider.tsx';
import { useSession } from '../app/SessionContext.ts';
import { builder, strengthModel, tournamentEngine } from '../app/game.ts';
import { getDatasetVersion, getDefaultSettings } from '../data/index.ts';
import {
  backupRecords,
  maximumBackupBytes,
  parseBackup,
  serializeBackup,
  type GameBackup,
} from '../engine/backup.ts';
import { installSnapshot } from '../utils/game-storage.ts';
import { roundLabels } from '../utils/tournament-display.ts';
const services = { builder, model: strengthModel, tournament: tournamentEngine };
const dateLabel = (value: string) =>
  new Date(value).toLocaleString(getIntlLocale(), { dateStyle: 'medium', timeStyle: 'short' });
export function BackupPanel() {
  useLanguage();
  const { draft, currentTeam } = useDraft();
  const { tournament } = useTournament();
  const { entries } = useHistory();
  const { reduceMotion, locale } = useSettings();
  const { restored, restoreCompleted, acknowledgeRestore } = useSession();
  const [backup, setBackup] = useState<GameBackup | null>(null);
  const [fileName, setFileName] = useState('');
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(
    restored ? 'Dein Spielstand wurde wiederhergestellt.' : '',
  );
  const [confirm, setConfirm] = useState(false);
  const sequence = useRef(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (restored) {
      panel.current?.focus();
      acknowledgeRestore();
    }
  }, [restored, acknowledgeRestore]);
  useEffect(() => {
    if (confirm) dialog.current?.showModal();
    else dialog.current?.close();
  }, [confirm]);
  function download() {
    try {
      const now = new Date().toISOString();
      const raw = serializeBackup(
        {
          schemaVersion: 1,
          datasetVersion: getDatasetVersion(),
          currentDraft: draft,
          currentTeam,
          currentTournament: tournament,
          completedTournaments: entries,
          userSettings: { ...getDefaultSettings(), reduceMotion, locale },
        },
        services,
        now,
      );
      const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `prime-xi-spielstand-${now.replace(/[:.]/g, '-')}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setError('');
      setMessage(
        'Deine Sicherungsdatei wurde zum Herunterladen erstellt. Bewahre sie außerhalb dieses Browsers auf.',
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Die Sicherung konnte nicht erstellt werden.',
      );
    }
  }
  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const request = ++sequence.current;
    const file = event.target.files?.[0];
    setBackup(null);
    setError('');
    setMessage('');
    setFileName(file?.name ?? '');
    if (!file) {
      setReading(false);
      return;
    }
    if (file.size > maximumBackupBytes) {
      setReading(false);
      setError('Die Sicherung darf höchstens 8 MB groß sein.');
      return;
    }
    setReading(true);
    try {
      const value = parseBackup(await file.text(), services);
      if (sequence.current === request) setBackup(value);
    } catch (reason) {
      if (sequence.current === request)
        setError(
          reason instanceof Error ? reason.message : 'Die Datei konnte nicht gelesen werden.',
        );
    } finally {
      if (sequence.current === request) setReading(false);
    }
  }
  function restore() {
    if (!backup) return;
    try {
      // Revalidate immediately before committing the single replacement record.
      const verified = parseBackup(JSON.stringify(backup), services);
      installSnapshot(window.localStorage, backupRecords(verified.state));
      restoreCompleted();
    } catch {
      setConfirm(false);
      setError(
        'Die Sicherung konnte nicht gespeichert werden. Prüfe den freien Browserspeicher und die Speicherberechtigung. Dein bisheriger Spielstand bleibt unverändert.',
      );
    }
  }
  const imported = backup?.state;
  const importedTournament = imported?.currentTournament;
  return (
    <section
      ref={panel}
      tabIndex={-1}
      className="panel settings-panel backup-panel"
      aria-labelledby="backup-title"
    >
      <p className="eyebrow">{t('DEINE DATEN BLEIBEN BEI DIR')}</p>
      <h2 id="backup-title">{t('Spielstand sichern & wiederherstellen')}</h2>
      <p>
        {t(
          'Speichere deinen geladenen Draft, deine Elf, dein Turnier, das Archiv und deine Einstellungen in einer Datei. Auch noch nicht dauerhaft gespeicherte \u00C4nderungen aus dieser Sitzung werden gesichert.',
        )}
      </p>
      <button className="button button--secondary" onClick={download}>
        <Download size={16} aria-hidden="true" />
        {t(' Sicherung herunterladen')}
      </button>
      <div className="backup-import">
        <label htmlFor="backup-file">{t('Sicherungsdatei ausw\u00E4hlen')}</label>
        <input
          id="backup-file"
          type="file"
          accept=".json,application/json"
          onChange={choose}
          aria-describedby="backup-file-help"
        />
        <p id="backup-file-help" className="settings-caption">
          {t(
            'PRIME-XI-Sicherung als JSON, h\u00F6chstens 8 MB. Die Datei wird nur auf deinem Ger\u00E4t gepr\u00FCft und nicht hochgeladen.',
          )}
        </p>
      </div>
      {(reading || message) && (
        <p className="backup-feedback" role="status">
          {t(reading ? 'Sicherung wird geprüft …' : message)}
        </p>
      )}
      {error && (
        <p className="builder-alert builder-alert--error" role="alert">
          {t(error)}
        </p>
      )}
      {backup && imported && (
        <div className="backup-preview" role="region" aria-label={t('Sicherungsvorschau')}>
          <h3>{t('Gepr\u00FCfte Sicherung')}</h3>
          {imported.datasetVersion !== getDatasetVersion() && imported.currentDraft && (
            <p className="settings-caption">
              {t(
                'Die Auswahl dieses \u00E4lteren Drafts bleibt g\u00FCltig. Aktuelle Saisonratings und L\u00E4nderzuordnungen k\u00F6nnen seine St\u00E4rke und Chemie \u00E4ndern. Gespeicherte Teams, Turniere und Archive behalten ihre bisherigen Werte.',
              )}
            </p>
          )}
          <p className="backup-file-name">
            {fileName} · {t(dateLabel(backup.exportedAt))}
          </p>
          <dl>
            <div>
              <dt>{t('Draft')}</dt>
              <dd>
                {t(
                  imported.currentDraft
                    ? `${imported.currentDraft.picks.length} / 11 Spieler`
                    : 'Kein Draft',
                )}
              </dd>
            </div>
            <div>
              <dt>{t('Gespeicherte Elf')}</dt>
              <dd>{t(imported.currentTeam?.name ?? 'Keine Elf')}</dd>
            </div>
            <div>
              <dt>{t('Turnier')}</dt>
              <dd>
                {t(
                  !importedTournament
                    ? 'Kein Turnier'
                    : importedTournament.phase === 'completed'
                      ? 'Abgeschlossen'
                      : importedTournament.phase === 'league'
                        ? `Ligaphase · ${tournamentEngine.progress(importedTournament).completedRounds} / 8 Spieltage`
                        : roundLabels[importedTournament.phase],
                )}
              </dd>
            </div>
            <div>
              <dt>{t('Archiv')}</dt>
              <dd>
                {imported.completedTournaments.length}
                {t(' ')}
                {t(
                  imported.completedTournaments.length === 1
                    ? 'abgeschlossenes Turnier'
                    : 'abgeschlossene Turniere',
                )}
              </dd>
            </div>
            <div>
              <dt>{t('Bewegung reduzieren')}</dt>
              <dd>{t(imported.userSettings.reduceMotion ? 'An' : 'Aus')}</dd>
            </div>
            <div>
              <dt>{t('Sprache')}</dt>
              <dd>
                {languages.find((language) => language.id === imported.userSettings.locale)?.name}
              </dd>
            </div>
          </dl>
          <button className="button button--primary" onClick={() => setConfirm(true)}>
            <Upload size={16} aria-hidden="true" />
            {t(' Spielstand wiederherstellen')}
          </button>
        </div>
      )}
      <dialog
        ref={dialog}
        className="builder-confirm"
        aria-labelledby="backup-confirm-title"
        onCancel={() => setConfirm(false)}
        onClose={() => setConfirm(false)}
      >
        <h2 id="backup-confirm-title">{t('Aktuellen Spielstand ersetzen?')}</h2>
        <p>
          {t(
            'Draft, gespeicherte Elf, aktuelles Turnier, Archiv und Einstellungen in diesem Browser werden vollst\u00E4ndig durch die gepr\u00FCfte Sicherung ersetzt. Sichere deinen aktuellen Stand vorher, wenn du ihn behalten m\u00F6chtest. Die Archive werden nicht zusammengef\u00FChrt.',
          )}
        </p>
        <div className="confirm-actions">
          <button className="button button--secondary" onClick={() => setConfirm(false)}>
            {t('Abbrechen')}
          </button>
          <button className="button button--primary" onClick={restore}>
            {t('Sicherung \u00FCbernehmen')}
          </button>
        </div>
      </dialog>
    </section>
  );
}
