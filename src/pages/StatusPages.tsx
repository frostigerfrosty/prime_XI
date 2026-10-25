import { t, useLanguage } from '../i18n/react.ts';
import { ArrowLeft, ArrowUpRight, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSettings } from '../app/SettingsProvider.tsx';
import { PageHeading } from '../components/ui.tsx';
import { BackupPanel } from '../components/BackupPanel.tsx';
import { languages, isLanguage } from '../i18n/locale.ts';
export function SettingsPage() {
  useLanguage();
  const { reduceMotion, setReduceMotion, storageAvailable, locale, setLocale, languageError } =
    useSettings();
  return (
    <>
      <PageHeading
        eyebrow={t('GANZ NACH DEINEM GESCHMACK')}
        title={t('Einstellungen')}
        description={t('Kleine Anpassungen für dein Spielerlebnis.')}
      />
      {languageError && (
        <p className="builder-alert" role="alert">
          {t(languageError)}
        </p>
      )}
      <div className="settings-grid">
        <section className="panel settings-panel">
          <p className="eyebrow">{t('SPRACHE')}</p>
          <h2>{t('Deine Spielsprache')}</h2>
          <label className="builder-field">
            <span>{t('Sprache')}</span>
            <select
              value={locale}
              onChange={(event) => {
                if (isLanguage(event.target.value)) setLocale(event.target.value);
              }}
            >
              {languages.map((language) => (
                <option key={language.id} value={language.id}>
                  {language.name}
                </option>
              ))}
            </select>
          </label>
          <p className="settings-caption">
            {t(
              'Die Auswahl gilt f\u00FCr die Oberfl\u00E4che und bleibt in diesem Browser gespeichert. Spieler- und Vereinsnamen bleiben erhalten.',
            )}
          </p>
        </section>
        <section className="panel settings-panel">
          <p className="eyebrow">{t('DARSTELLUNG')}</p>
          <h2>{t('Ein ruhigeres Spielfeld')}</h2>
          <label className="setting-row">
            <span>
              <strong>{t('Bewegung reduzieren')}</strong>
              <small>{t('Verzichtet auf Animationen und bewegte \u00DCberg\u00E4nge.')}</small>
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
            {t(
              'Deine Einstellung wird in diesem Browser gespeichert. Eine Systemeinstellung f\u00FCr reduzierte Bewegung wird immer ber\u00FCcksichtigt.',
            )}
          </p>
          {!storageAvailable && (
            <p className="storage-warning" role="status">
              {t(
                'Dein Browser erlaubt gerade keine lokale Speicherung. Die Einstellung gilt f\u00FCr diese Sitzung.',
              )}
            </p>
          )}
        </section>
        <section className="panel settings-panel">
          <p className="eyebrow">{t('\u00DCBER DAS PROJEKT')}</p>
          <h2>{t('PRIME XI')}</h2>
          <p>
            {t(
              'Ein Fu\u00DFballsimulator \u00FCber die Grenzen einzelner Saisons hinweg. Ohne Konto, ohne notwendige Verbindung zu einer Fu\u00DFball-API.',
            )}
          </p>
          <dl className="project-info">
            <div>
              <dt>{t('Version')}</dt>
              <dd>{t('0.16 \u00B7 Entwicklungsvorschau')}</dd>
            </div>
            <div>
              <dt>{t('Stand')}</dt>
              <dd>{t('Team Builder, komplettes Turnier & Historie')}</dd>
            </div>
            <div>
              <dt>{t('Bilder')}</dt>
              <dd>{t('Eigene Vereinsmonogramme & Initialen')}</dd>
            </div>
          </dl>
          <p className="settings-caption">
            <Shield size={15} aria-hidden="true" />
            {t(
              ' Historische Kaderangaben werden noch gepr\u00FCft. Alle Ratings sind eigene redaktionelle Spielwerte.',
            )}
          </p>
          <Link className="text-link" to="/teams">
            {t('Zum Prime-Katalog ')}
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </section>
        <BackupPanel />
      </div>
    </>
  );
}
export function NotFoundPage() {
  useLanguage();
  return (
    <section className="panel no-results">
      <p className="eyebrow">{t('404 \u00B7 ABSEITS')}</p>
      <h1>{t('Hier ist das Spielfeld zu Ende.')}</h1>
      <p>{t('Diese Seite existiert nicht. Zur\u00FCck zum Spiel?')}</p>
      <Link className="button button--primary" to="/">
        <ArrowLeft size={16} aria-hidden="true" />
        {t(' Zum Dashboard')}
      </Link>
    </section>
  );
}
