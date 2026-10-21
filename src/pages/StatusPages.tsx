import { ArrowLeft, ArrowUpRight, History, Shield, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSettings } from '../app/SettingsProvider.tsx';
import { EmptyState, PageHeading } from '../components/ui.tsx';
import { builder, useDraft } from '../app/DraftProvider.tsx';
import { formatStrength } from '../utils/display.ts';

export function TournamentPage() {
  const { draft, currentTeam, teamPersisted } = useDraft();
  const ready = Boolean(currentTeam) || (draft ? builder.status(draft).complete : false);
  return (
    <>
      <PageHeading
        eyebrow="DIE GRÖSSTE BÜHNE"
        title="Dein Turnier"
        description="Deine Elf. 35 Gegner. Ein gemeinsames Ziel."
      />
      <EmptyState
        icon={Trophy}
        eyebrow="NOCH KEIN ANPFIFF"
        title={
          ready
            ? 'Deine Elf steht. Die große Bühne folgt.'
            : 'Große Spiele brauchen eine vollständige Elf.'
        }
        description={
          ready
            ? currentTeam
              ? `Deine Elf hat eine Matchstärke von ${formatStrength(currentTeam.strength.matchStrength)} und ist ${teamPersisted ? 'im Browser gespeichert' : 'für diese Sitzung vorhanden'}. Matchsimulation und Turniermodus folgen in den nächsten Etappen.`
              : 'Deine Aufstellung und ihre Matchstärke sind vollständig. Speichere die Elf im Team Builder. Matchsimulation und Turniermodus folgen in den nächsten Etappen.'
            : 'Hier erscheinen später Spielplan, Tabelle und Ergebnisse. Vervollständige zuerst deine Elf mit Coach und Captain. Der Turniermodus folgt in einer kommenden Etappe.'
        }
      />
      <div className="format-strip panel">
        <span>
          <strong>36</strong> Teilnehmer
        </span>
        <span>
          <strong>8</strong> Ligaspiele pro Team
        </span>
        <span>
          <strong>1</strong> Sieger
        </span>
        <p>Geplantes Format · Ligaphase, Playoffs und K.-o.-Runden</p>
      </div>
    </>
  );
}

export function HistoryPage() {
  return (
    <>
      <PageHeading
        eyebrow="DEINE GESCHICHTE"
        title="Die Spiele bleiben."
        description="Deine abgeschlossenen Turniere bekommen hier ihren Platz."
      />
      <EmptyState
        icon={History}
        eyebrow="DAS ERSTE KAPITEL IST NOCH OFFEN"
        title="Jede Legende fängt bei null an."
        description="Du hast noch kein Turnier abgeschlossen. Später findest du hier deine Teams, Platzierungen und Ergebnisse."
      />
    </>
  );
}

export function SettingsPage() {
  const { reduceMotion, setReduceMotion, storageAvailable } = useSettings();
  return (
    <>
      <PageHeading
        eyebrow="GANZ NACH DEINEM GESCHMACK"
        title="Einstellungen"
        description="Kleine Anpassungen für dein Spielerlebnis."
      />
      <div className="settings-grid">
        <section className="panel settings-panel">
          <p className="eyebrow">DARSTELLUNG</p>
          <h2>Ein ruhigeres Spielfeld</h2>
          <label className="setting-row">
            <span>
              <strong>Bewegung reduzieren</strong>
              <small>Verzichtet auf Animationen und bewegte Übergänge.</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={reduceMotion}
              onChange={(event) => setReduceMotion(event.target.checked)}
            />
            <span className="toggle-track" aria-hidden="true" />
          </label>
          <p className="settings-caption">
            Deine Einstellung wird in diesem Browser gespeichert. Eine Systemeinstellung für
            reduzierte Bewegung wird immer berücksichtigt.
          </p>
          {!storageAvailable && (
            <p className="storage-warning" role="status">
              Dein Browser erlaubt gerade keine lokale Speicherung. Die Einstellung gilt für diese
              Sitzung.
            </p>
          )}
        </section>
        <section className="panel settings-panel">
          <p className="eyebrow">ÜBER DAS PROJEKT</p>
          <h2>PRIME XI</h2>
          <p>
            Ein Fußballsimulator über die Grenzen einzelner Saisons hinweg. Ohne Konto, ohne
            notwendige Verbindung zu einer Fußball-API.
          </p>
          <dl className="project-info">
            <div>
              <dt>Version</dt>
              <dd>0.5 · Teamstärke & Boni</dd>
            </div>
            <div>
              <dt>Stand</dt>
              <dd>Team Builder, Teamstärke & gespeicherte Elf</dd>
            </div>
            <div>
              <dt>Bilder</dt>
              <dd>Eigene Vereinsmonogramme & Initialen</dd>
            </div>
          </dl>
          <p className="settings-caption">
            <Shield size={15} aria-hidden="true" /> Historische Kaderangaben werden noch geprüft.
            Alle Ratings sind eigene redaktionelle Spielwerte.
          </p>
          <Link className="text-link" to="/teams">
            Zum Prime-Katalog <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </section>
      </div>
    </>
  );
}

export function NotFoundPage() {
  return (
    <section className="panel no-results">
      <p className="eyebrow">404 · ABSEITS</p>
      <h1>Hier ist das Spielfeld zu Ende.</h1>
      <p>Diese Seite existiert nicht. Zurück zum Spiel?</p>
      <Link className="button button--primary" to="/">
        <ArrowLeft size={16} aria-hidden="true" /> Zum Dashboard
      </Link>
    </section>
  );
}
