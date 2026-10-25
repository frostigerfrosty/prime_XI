import { t, useLanguage } from '../i18n/react.ts';
import { Component, lazy, Suspense, type ReactNode } from 'react';
const App = lazy(() => import('./App.tsx').then((module) => ({ default: module.App })));
function LoadingScreen() {
  useLanguage();
  return (
    <main className="startup-screen">
      <section>
        <p className="startup-brand">{t('PRIME XI')}</p>
        <h1>{t('Dein Spielfeld wird vorbereitet.')}</h1>
        <p role="status">{t('Der lokale Katalog wird geladen \u2026')}</p>
      </section>
    </main>
  );
}
class StartupBoundary extends Component<
  {
    children: ReactNode;
  },
  {
    failed: boolean;
  }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main className="startup-screen">
          <section>
            <p className="startup-brand">{t('PRIME XI')}</p>
            <h1>{t('Dein Spielfeld ist noch nicht erreichbar.')}</h1>
            <p role="alert">
              {t(
                'Die Anwendung oder der Katalog konnte nicht geladen werden. Pr\u00FCfe deine Verbindung und lade erneut. Deine gespeicherten Spielst\u00E4nde bleiben erhalten.',
              )}
            </p>
            <button className="startup-reload" onClick={() => window.location.reload()}>
              {t('Erneut laden')}
            </button>
          </section>
        </main>
      );
    return this.props.children;
  }
}
export function Startup() {
  useLanguage();
  return (
    <StartupBoundary>
      <Suspense fallback={<LoadingScreen />}>
        <App />
      </Suspense>
    </StartupBoundary>
  );
}
