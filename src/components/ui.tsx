import { ArrowUpRight, Check, Shield, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getClubBadgePath } from '../data/index.ts';
import type { PrimeTeam } from '../types/database.ts';
import { formatNumber } from '../utils/display.ts';

export function Brand() {
  return (
    <Link className="brand" to="/" aria-label="PRIME XI · Dashboard">
      <span className="brand-mark">
        <Shield size={25} strokeWidth={1.5} />
        <span>XI</span>
      </span>
      <span>
        <strong>
          PRIME <em>XI</em>
        </strong>
        <small>FOOTBALL SIMULATOR</small>
      </span>
    </Link>
  );
}

export function ClubBadge({
  clubId,
  size = 'normal',
}: {
  clubId: string;
  size?: 'normal' | 'large';
}) {
  // Names are printed next to the image, so the monogram is decorative.
  return (
    <img
      className={`club-badge club-badge--${size}`}
      src={getClubBadgePath(clubId, import.meta.env.BASE_URL)}
      alt=""
      width={56}
      height={56}
    />
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}

export function TeamCard({ team }: { team: PrimeTeam }) {
  return (
    <Link className="team-card" to={`/teams/${team.id}`}>
      <div className="team-card-top">
        <span className="season-tag">{team.season}</span>
        <ArrowUpRight size={17} aria-hidden="true" />
      </div>
      <div className="team-card-main">
        <ClubBadge clubId={team.clubId} size="large" />
        <div>
          <h3>{team.clubName}</h3>
          <p>{team.coach?.name ?? 'Trainer offen'}</p>
        </div>
      </div>
      <div className="team-card-bottom">
        <span>
          {team.players.length} Spieler <span aria-hidden="true">·</span> {team.formation}
        </span>
        <span className="rating">
          <strong>{team.teamRating === null ? '–' : formatNumber(team.teamRating)}</strong>{' '}
          <small>Ø XI</small>
        </span>
      </div>
    </Link>
  );
}

export function EmptyState({
  icon: Icon,
  eyebrow,
  title,
  description,
  action = true,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  action?: boolean;
}) {
  return (
    <section className="panel empty-state">
      <div className="empty-orbit" aria-hidden="true">
        <span />
        <Icon size={39} strokeWidth={1.2} />
      </div>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{description}</p>
      {action && (
        <Link className="button button--primary" to="/team-builder">
          Zum Team Builder <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}

export function CatalogNote() {
  return (
    <p className="catalog-note">
      <Shield size={15} aria-hidden="true" /> Redaktioneller Katalog · Historische Angaben werden
      geprüft. Ratings sind eigene Spielwerte.
    </p>
  );
}

export function Step({
  number,
  title,
  text,
  done = false,
}: {
  number: string;
  title: string;
  text: string;
  done?: boolean;
}) {
  return (
    <div className="step">
      <span className={`step-number ${done ? 'step-number--done' : ''}`}>
        {done ? <Check size={16} aria-hidden="true" /> : number}
      </span>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </div>
  );
}
