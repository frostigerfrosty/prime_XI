import { Component, lazy, Suspense, useState, type ReactNode } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from '../components/Layout.tsx';
import { SettingsProvider } from './SettingsProvider.tsx';
import { DraftProvider } from './DraftProvider.tsx';
import { TournamentProvider } from './TournamentProvider.tsx';
import { HistoryProvider } from './HistoryProvider.tsx';
import { SessionContext } from './SessionContext.ts';

const DashboardPage = lazy(() => import('../pages/DashboardPage.tsx'));
const BuilderPage = lazy(() => import('../pages/BuilderPage.tsx'));
const TeamsPage = lazy(() => import('../pages/TeamsPage.tsx'));
const TeamDetailPage = lazy(() => import('../pages/TeamDetailPage.tsx'));
const ComparePage = lazy(() => import('../pages/ComparePage.tsx'));
const MatchPage = lazy(() => import('../pages/MatchPage.tsx'));
const TournamentPage = lazy(() => import('../pages/TournamentPage.tsx'));
const HistoryPage = lazy(() => import('../pages/HistoryPage.tsx'));
const SettingsPage = lazy(() =>
  import('../pages/StatusPages.tsx').then((module) => ({ default: module.SettingsPage })),
);
const NotFoundPage = lazy(() =>
  import('../pages/StatusPages.tsx').then((module) => ({ default: module.NotFoundPage })),
);

class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main className="fatal-error">
          <p className="eyebrow">PRIME XI</p>
          <h1>Kurze Spielunterbrechung.</h1>
          <p>Die Seite konnte nicht geladen werden. Bitte lade die Anwendung neu.</p>
          <a className="button button--primary" href={import.meta.env.BASE_URL}>
            Neu laden
          </a>
        </main>
      );
    return this.props.children;
  }
}

export function App() {
  const [session, setSession] = useState(0);
  const [restored, setRestored] = useState(false);
  return (
    <AppErrorBoundary>
      <SessionContext
        value={{
          restored,
          acknowledgeRestore: () => setRestored(false),
          restoreCompleted: () => {
            setRestored(true);
            setSession((value) => value + 1);
          },
        }}
      >
        <SettingsProvider key={session}>
          <DraftProvider>
            <HistoryProvider>
              <TournamentProvider>
                <HashRouter>
                  <Suspense
                    fallback={
                      <div className="page-loading" role="status">
                        <span className="loading-mark">XI</span>
                        <p>Dein Spielfeld wird vorbereitet …</p>
                      </div>
                    }
                  >
                    <Routes>
                      <Route element={<Layout />}>
                        <Route index element={<DashboardPage />} />
                        <Route path="team-builder" element={<BuilderPage />} />
                        <Route path="teams" element={<TeamsPage />} />
                        <Route path="teams/:teamId" element={<TeamDetailPage />} />
                        <Route path="compare" element={<ComparePage />} />
                        <Route path="tournament" element={<TournamentPage />} />
                        <Route path="test-match" element={<MatchPage />} />
                        <Route path="history" element={<HistoryPage />} />
                        <Route path="history/:entryId" element={<HistoryPage />} />
                        <Route path="settings" element={<SettingsPage />} />
                        <Route path="*" element={<NotFoundPage />} />
                      </Route>
                    </Routes>
                  </Suspense>
                </HashRouter>
              </TournamentProvider>
            </HistoryProvider>
          </DraftProvider>
        </SettingsProvider>
      </SessionContext>
    </AppErrorBoundary>
  );
}
