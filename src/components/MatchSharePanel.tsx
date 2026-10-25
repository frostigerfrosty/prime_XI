import { t, useLanguage } from '../i18n/react.ts';
import { useEffect, useRef, useState } from 'react';
import { Copy } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  isShareableMatchCode,
  matchSetupParams,
  type MatchLinkVersions,
  type MatchSetup,
} from '../engine/match-link.ts';
export function MatchSharePanel({
  setup,
  versions,
  catalogPair,
}: {
  setup: MatchSetup;
  versions: MatchLinkVersions;
  catalogPair: boolean;
}) {
  useLanguage();
  const [message, setMessage] = useState('');
  const [copying, setCopying] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const shareable = catalogPair && isShareableMatchCode(setup.seed);
  const address = new URL(window.location.href);
  address.search = '';
  address.hash = `/test-match?${matchSetupParams(setup, versions).toString()}`;
  const url = shareable ? address.href : '';
  async function copy() {
    if (!url || copying) return;
    setCopying(true);
    setMessage('');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);
      if (active.current) setMessage('Testspiellink kopiert.');
    } catch {
      if (active.current) {
        setMessage(
          'Der Browser erlaubt das automatische Kopieren gerade nicht. Kopiere den markierten Link manuell.',
        );
        input.current?.focus();
        input.current?.select();
      }
    } finally {
      if (active.current) setCopying(false);
    }
  }
  return (
    <section className="panel match-share" aria-labelledby="match-share-title">
      <h2 id="match-share-title">{t('Diese Begegnung teilen')}</h2>
      {!catalogPair ? (
        <>
          <p>
            {t(
              'Deine eigene Elf geh\u00F6rt zu deinem lokalen Spielstand. F\u00FCr einen anderen Browser kannst du deinen Spielstand als Datei sichern. Teilbare Testspiellinks sind f\u00FCr zwei Katalogteams verf\u00FCgbar.',
            )}
          </p>
          <Link className="text-link" to="/settings">
            {t('Zur Spielstandsicherung')}
          </Link>
        </>
      ) : (
        <>
          <p>
            {t(
              'Der Link enth\u00E4lt Teams, Spielmodus, Platzwahl und Spielcode. \u00D6ffne ihn und w\u00E4hle',
            )}
            {t(' ')}
            <strong>{t('Anpfiff')}</strong>
            {t(', um die Begegnung mit demselben Katalog- und Regelstand zu wiederholen.')}
          </p>
          {shareable ? (
            <>
              <label className="match-field">
                <span>{t('Testspiellink')}</span>
                <input
                  ref={input}
                  readOnly
                  value={url}
                  onFocus={(event) => event.currentTarget.select()}
                />
              </label>
              <button className="button button--secondary" disabled={copying} onClick={copy}>
                <Copy size={16} aria-hidden="true" />
                {t(copying ? 'Link wird kopiert …' : 'Link kopieren')}
              </button>
            </>
          ) : (
            <p>
              {t('Trage einen Spielcode mit 1 bis 100 Zeichen ein, um einen Link zu erstellen.')}
            </p>
          )}
          {message && <p role="status">{t(message)}</p>}
        </>
      )}
    </section>
  );
}
