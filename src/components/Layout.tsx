import { useEffect, useRef } from 'react';
import {
  ArrowUpRight,
  ChevronRight,
  CircleHelp,
  History,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  Settings,
  Shield,
  Trophy,
  UsersRound,
  X,
} from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Brand } from './ui.tsx';

const navigation = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/team-builder', label: 'Team Builder', icon: UsersRound },
  { to: '/tournament', label: 'Turnier', icon: Trophy },
  { to: '/teams', label: 'Prime-Teams', icon: Shield },
  { to: '/history', label: 'Historie', icon: History },
];

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="sidebar-top">
        <Brand />
        <p className="nav-label">DEIN SPIEL</p>
        <nav aria-label="Hauptnavigation">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onNavigate}
              className={({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`}
            >
              <Icon size={19} strokeWidth={1.6} aria-hidden="true" />
              <span>{label}</span>
              {to === '/tournament' && (
                <LockKeyhole className="nav-lock" size={13} aria-hidden="true" />
              )}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="sidebar-bottom">
        <div className="sidebar-callout">
          <span className="eyebrow">EINE NEUE ÄRA</span>
          <h3>
            Dein Team.
            <br />
            Deine Geschichte.
          </h3>
          <p>
            Die Besten ihrer Zeit.
            <br />
            Vereint in deiner Elf.
          </p>
          <Link to="/team-builder" onClick={onNavigate}>
            Zur Aufstellung <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <NavLink
          to="/settings"
          onClick={onNavigate}
          className={({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`}
        >
          <Settings size={18} aria-hidden="true" />
          Einstellungen
        </NavLink>
        <p className="sidebar-footer">
          PRIME XI <span>v0.3 · Etappe 1</span>
        </p>
      </div>
    </>
  );
}

export function Layout() {
  const { pathname } = useLocation();
  const dialog = useRef<HTMLDialogElement>(null);
  const main = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);
  const title =
    navigation.find((item) => item.to === pathname)?.label ??
    (pathname.startsWith('/teams/')
      ? 'Teamdetails'
      : pathname === '/settings'
        ? 'Einstellungen'
        : 'Seite nicht gefunden');
  useEffect(() => {
    document.title = `${title} · PRIME XI`;
    if (previousPath.current !== pathname) {
      dialog.current?.close();
      window.scrollTo({ top: 0, behavior: 'instant' });
      main.current?.focus({ preventScroll: true });
      previousPath.current = pathname;
    }
  }, [pathname, title]);
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
        Zum Inhalt springen
      </a>
      <aside className="sidebar">
        <Navigation />
      </aside>
      <dialog
        className="mobile-drawer"
        ref={dialog}
        aria-label="Navigation"
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className="mobile-drawer-content">
          <button
            className="icon-button drawer-close"
            aria-label="Menü schließen"
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
              aria-label="Menü öffnen"
              onClick={() => dialog.current?.showModal()}
            >
              <Menu size={21} />
            </button>
            <span className="topbar-product">PRIME XI</span>
            <ChevronRight size={13} aria-hidden="true" />
            <span>{title}</span>
          </div>
          <div className="topbar-actions">
            <span className="status-pill">
              <span className="status-dot" /> ENTWICKLUNGSVERSION
            </span>
            <Link className="icon-button" to="/settings" aria-label="Einstellungen öffnen">
              <Settings size={18} />
            </Link>
          </div>
        </header>
        <main className="main-content" id="main-content" ref={main} tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="page-footer">
          <span>Große Teams. Unendliche Möglichkeiten.</span>
          <Link to="/settings">
            <CircleHelp size={14} aria-hidden="true" /> Über PRIME XI
          </Link>
        </footer>
      </div>
    </div>
  );
}
