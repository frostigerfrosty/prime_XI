import { Component, lazy, Suspense, type ReactNode } from 'react';

const App = lazy(() => import('./App.tsx').then((module) => ({ default: module.App })));

function LoadingScreen() {
  return (
    <main className="startup-screen">
      <section>
        <p className="startup-brand">PRIME XI</p>
        <h1>Dein Spielfeld wird vorbereitet.</h1>
        <p role="status">Der lokale Katalog wird geladen …</p>
      </section>
    </main>
  );
}

class StartupBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main className="startup-screen">
          <section>
            <p className="startup-brand">PRIME XI</p>
            <h1>Dein Spielfeld ist noch nicht erreichbar.</h1>
            <p role="alert">
              Die Anwendung oder der Katalog konnte nicht geladen werden. Prüfe deine Verbindung und
              lade erneut. Deine gespeicherten Spielstände bleiben erhalten.
            </p>
            <button className="startup-reload" onClick={() => window.location.reload()}>
              Erneut laden
            </button>
          </section>
        </main>
      );
    return this.props.children;
  }
}

export function Startup() {
  return (
    <StartupBoundary>
      <Suspense fallback={<LoadingScreen />}>
        <App />
      </Suspense>
    </StartupBoundary>
  );
}
