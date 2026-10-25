import { t, useLanguage } from '../i18n/react.ts';
import { useEffect, useRef } from 'react';
import {
  ArrowUpRight,
  ChevronRight,
  CircleHelp,
  Columns2,
  History,
  LayoutDashboard,
  Menu,
  Settings,
  Shield,
  Swords,
  Trophy,
  UsersRound,
  X,
} from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Brand } from './ui.tsx';
const navigation = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/team-builder', label: 'Team Builder', icon: UsersRound },
  { to: '/test-match', label: 'Testspiel', icon: Swords },
  { to: '/tournament', label: 'Turnier', icon: Trophy },
  { to: '/teams', label: 'Prime-Teams', icon: Shield },
  { to: '/compare', label: 'Teamvergleich', icon: Columns2 },
  { to: '/history', label: 'Historie', icon: History },
];
function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  useLanguage();
  return (
    <>
      <div className="sidebar-top">
        <Brand />
        <p className="nav-label">{t('DEIN SPIEL')}</p>
        <nav aria-label={t('Hauptnavigation')}>
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onNavigate}
              className={({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`}
            >
              <Icon size={19} strokeWidth={1.6} aria-hidden="true" />
              <span>{t(label)}</span>
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="sidebar-bottom">
        <div className="sidebar-callout">
          <span className="eyebrow">{t('EINE NEUE \u00C4RA')}</span>
          <h3>
            {t('Dein Team.')}
            <br />
            {t('Deine Geschichte.')}
          </h3>
          <p>
            {t('Die Besten ihrer Zeit.')}
            <br />
            {t('Vereint in deiner Elf.')}
          </p>
          <Link to="/team-builder" onClick={onNavigate}>
            {t('Zur Aufstellung ')}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <NavLink
          to="/settings"
          onClick={onNavigate}
          className={({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`}
        >
          <Settings size={18} aria-hidden="true" />
          {t('Einstellungen')}
        </NavLink>
        <p className="sidebar-footer">
          {t('PRIME XI ')}
          <span>{t('v0.16 \u00B7 Entwicklungsvorschau')}</span>
        </p>
      </div>
    </>
  );
}
export function Layout() {
  const language = useLanguage();
  const { pathname } = useLocation();
  const dialog = useRef<HTMLDialogElement>(null);
  const main = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);
  const title =
    navigation.find((item) => item.to === pathname)?.label ??
    (pathname.startsWith('/teams/')
      ? 'Teamdetails'
      : pathname.startsWith('/history/')
        ? 'Turnierrückblick'
        : pathname === '/settings'
          ? 'Einstellungen'
          : 'Seite nicht gefunden');
  useEffect(() => {
    document.title = `${t(title)} · PRIME XI`;
    if (previousPath.current !== pathname) {
      dialog.current?.close();
      window.scrollTo({ top: 0, behavior: 'instant' });
      main.current?.focus({ preventScroll: true });
      previousPath.current = pathname;
    }
  }, [pathname, title, language]);
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          main.current?.focus();
        }}
      >
        {t('Zum Inhalt springen')}
      </a>
      <aside className="sidebar">
        <Navigation />
      </aside>
      <dialog
        className="mobile-drawer"
        ref={dialog}
        aria-label={t('Navigation')}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className="mobile-drawer-content">
          <button
            className="icon-button drawer-close"
            aria-label={t('Menü schließen')}
            onClick={() => dialog.current?.close()}
          >
            <X size={20} />
          </button>
          <Navigation onNavigate={() => dialog.current?.close()} />
        </div>
      </dialog>
      <div className="app-body">
        <header className="topbar">
          <div className="topbar-breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label={t('Menü öffnen')}
              onClick={() => dialog.current?.showModal()}
            >
              <Menu size={21} />
            </button>
            <span className="topbar-product">{t('PRIME XI')}</span>
            <ChevronRight size={13} aria-hidden="true" />
            <span>{t(title)}</span>
          </div>
          <div className="topbar-actions">
            <span className="status-pill">
              <span className="status-dot" />
              {t(' ENTWICKLUNGSVERSION')}
            </span>
            <Link className="icon-button" to="/settings" aria-label={t('Einstellungen öffnen')}>
              <Settings size={18} />
            </Link>
          </div>
        </header>
        <main className="main-content" id="main-content" ref={main} tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="page-footer">
          <span>{t('Gro\u00DFe Teams. Unendliche M\u00F6glichkeiten.')}</span>
          <Link to="/settings">
            <CircleHelp size={14} aria-hidden="true" />
            {t(' \u00DCber PRIME XI')}
          </Link>
        </footer>
      </div>
    </div>
  );
}
