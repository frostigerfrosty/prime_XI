import { ArrowLeft, ArrowUpRight, History, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSettings } from '../app/SettingsProvider.tsx';
import { EmptyState, PageHeading } from '../components/ui.tsx';
import { useTournament } from '../app/TournamentProvider.tsx';

export function HistoryPage() {
  const { tournament } = useTournament();
  const completed = tournament?.phase === 'completed';
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
        title={
          completed
            ? 'Dein Turnier ist beendet. Das Archiv folgt.'
            : 'Jede Legende fängt bei null an.'
        }
        description={
          completed
            ? 'Dein abgeschlossenes Turnier bleibt auf der Turnierseite erhalten. Das Archiv für mehrere Turniere folgt in Etappe 8.'
            : 'Du hast noch kein Turnier abgeschlossen. Später findest du hier deine Teams, Platzierungen und Ergebnisse.'
        }
        action={!completed}
      />
      {completed && (
        <Link className="button button--primary" to="/tournament">
          Zum abgeschlossenen Turnier
        </Link>
      )}
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
              <dd>0.8 · Komplettes Turnier</dd>
            </div>
            <div>
              <dt>Stand</dt>
              <dd>Team Builder, Ligaphase, Playoffs & K.-o.-Runden</dd>
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
