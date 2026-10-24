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
  new Date(value).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });

export function BackupPanel() {
  const { draft, currentTeam } = useDraft();
  const { tournament } = useTournament();
  const { entries } = useHistory();
  const { reduceMotion } = useSettings();
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
          userSettings: { ...getDefaultSettings(), reduceMotion },
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
      <p className="eyebrow">DEINE DATEN BLEIBEN BEI DIR</p>
      <h2 id="backup-title">Spielstand sichern & wiederherstellen</h2>
      <p>
        Speichere deinen geladenen Draft, deine Elf, dein Turnier, das Archiv und deine
        Einstellungen in einer Datei. Auch noch nicht dauerhaft gespeicherte Änderungen aus dieser
        Sitzung werden gesichert.
      </p>
      <button className="button button--secondary" onClick={download}>
        <Download size={16} aria-hidden="true" /> Sicherung herunterladen
      </button>
      <div className="backup-import">
        <label htmlFor="backup-file">Sicherungsdatei auswählen</label>
        <input
          id="backup-file"
          type="file"
          accept=".json,application/json"
          onChange={choose}
          aria-describedby="backup-file-help"
        />
        <p id="backup-file-help" className="settings-caption">
          PRIME-XI-Sicherung als JSON, höchstens 8 MB. Die Datei wird nur auf deinem Gerät geprüft
          und nicht hochgeladen.
        </p>
      </div>
      {(reading || message) && (
        <p className="backup-feedback" role="status">
          {reading ? 'Sicherung wird geprüft …' : message}
        </p>
      )}
      {error && (
        <p className="builder-alert builder-alert--error" role="alert">
          {error}
        </p>
      )}
      {backup && imported && (
        <div className="backup-preview" role="region" aria-label="Sicherungsvorschau">
          <h3>Geprüfte Sicherung</h3>
          {imported.datasetVersion !== getDatasetVersion() && imported.currentDraft && (
            <p className="settings-caption">
              Die Auswahl dieses älteren Drafts bleibt gültig. Die aktuelle Länderkorrektur kann
              seine Chemie ändern. Gespeicherte Teams, Turniere und Archive behalten ihre bisherigen
              Werte.
            </p>
          )}
          <p className="backup-file-name">
            {fileName} · {dateLabel(backup.exportedAt)}
          </p>
          <dl>
            <div>
              <dt>Draft</dt>
              <dd>
                {imported.currentDraft
                  ? `${imported.currentDraft.picks.length} / 11 Spieler`
                  : 'Kein Draft'}
              </dd>
            </div>
            <div>
              <dt>Gespeicherte Elf</dt>
              <dd>{imported.currentTeam?.name ?? 'Keine Elf'}</dd>
            </div>
            <div>
              <dt>Turnier</dt>
              <dd>
                {!importedTournament
                  ? 'Kein Turnier'
                  : importedTournament.phase === 'completed'
                    ? 'Abgeschlossen'
                    : importedTournament.phase === 'league'
                      ? `Ligaphase · ${tournamentEngine.progress(importedTournament).completedRounds} / 8 Spieltage`
                      : roundLabels[importedTournament.phase]}
              </dd>
            </div>
            <div>
              <dt>Archiv</dt>
              <dd>
                {imported.completedTournaments.length}{' '}
                {imported.completedTournaments.length === 1
                  ? 'abgeschlossenes Turnier'
                  : 'abgeschlossene Turniere'}
              </dd>
            </div>
            <div>
              <dt>Bewegung reduzieren</dt>
              <dd>{imported.userSettings.reduceMotion ? 'An' : 'Aus'}</dd>
            </div>
          </dl>
          <button className="button button--primary" onClick={() => setConfirm(true)}>
            <Upload size={16} aria-hidden="true" /> Spielstand wiederherstellen
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
        <h2 id="backup-confirm-title">Aktuellen Spielstand ersetzen?</h2>
        <p>
          Draft, gespeicherte Elf, aktuelles Turnier, Archiv und Einstellungen in diesem Browser
          werden vollständig durch die geprüfte Sicherung ersetzt. Sichere deinen aktuellen Stand
          vorher, wenn du ihn behalten möchtest. Die Archive werden nicht zusammengeführt.
        </p>
        <div className="confirm-actions">
          <button className="button button--secondary" onClick={() => setConfirm(false)}>
            Abbrechen
          </button>
          <button className="button button--primary" onClick={restore}>
            Sicherung übernehmen
          </button>
        </div>
      </dialog>
    </section>
  );
}
