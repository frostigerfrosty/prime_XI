import { ArrowLeft, ArrowUpRight, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSettings } from '../app/SettingsProvider.tsx';
import { PageHeading } from '../components/ui.tsx';

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
              <dd>0.9 · Turnierarchiv</dd>
            </div>
            <div>
              <dt>Stand</dt>
              <dd>Team Builder, komplettes Turnier & Historie</dd>
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
