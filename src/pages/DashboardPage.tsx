import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Layers3,
  Shield,
  Trophy,
  UsersRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { catalogStats, featuredTeamIds, teams } from '../app/catalog.ts';
import { ClubBadge, Step, TeamCard } from '../components/ui.tsx';
import { formatNumber, initials } from '../utils/display.ts';
import { builder, useDraft } from '../app/DraftProvider.tsx';

function HeroCards() {
  const cards = [
    { teamId: 'milan-2006-2007', personId: 'kaka', className: 'legend-card--left' },
    { teamId: 'barcelona-2010-2011', personId: 'messi', className: 'legend-card--center' },
    {
      teamId: 'real-madrid-2016-2017',
      personId: 'cristiano-ronaldo',
      className: 'legend-card--right',
    },
  ];
  return (
    <div
      className="hero-art"
      role="group"
      aria-label="Im Katalog: Kaká, Lionel Messi und Cristiano Ronaldo"
    >
      <div className="hero-pitch" aria-hidden="true">
        <span />
        <i />
      </div>
      <span className="hero-xi" aria-hidden="true">
        XI
      </span>
      {cards.map(({ teamId, personId, className }) => {
        const team = teams.find((candidate) => candidate.id === teamId)!;
        const player = team.players.find((candidate) => candidate.personId === personId)!;
        return (
          <Link
            to={`/teams/${teamId}`}
            key={personId}
            className={`legend-card ${className}`}
            aria-label={`${player.name} bei ${team.clubName} ${team.season} ansehen`}
          >
            <div className="legend-card-top">
              <span>
                <strong>{player.rating}</strong>
                <small>{player.position}</small>
              </span>
              <ClubBadge clubId={team.clubId} />
            </div>
            <div className="legend-initials">{initials(player.name)}</div>
            <div className="legend-card-name">
              <strong>{player.name}</strong>
              <span>
                {team.clubName} <span>· {team.season}</span>
              </span>
            </div>
          </Link>
        );
      })}
      <span className="hero-art-caption">VERSCHIEDENE ÄREN. EINE LEIDENSCHAFT.</span>
    </div>
  );
}

export default function DashboardPage() {
  const { draft } = useDraft();
  const draftStatus = draft ? builder.status(draft) : null;
  return (
    <>
      <div className="dashboard-intro">
        <div>
          <p className="eyebrow">DEIN PRIME-XI-HAUPTQUARTIER</p>
          <h1>Willkommen am Spielfeldrand.</h1>
        </div>
        <span className="subtle-chip">
          <span className="status-dot" /> Bereit für deine Geschichte
        </span>
      </div>
      <section className="hero panel">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="short-line" /> DAS BESTE AUS 20 JAHRGÄNGEN
          </p>
          <h2>
            Deine Elf.
            <br />
            <em>Deine Ära.</em>
          </h2>
          <p>
            Die Magie von damals. Die Möglichkeiten von heute. Vereine die Stars ihrer Prime zu
            deinem Dream-Team.
          </p>
          <Link className="button button--primary" to="/team-builder">
            Zum Team Builder <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
          <Link className="hero-secondary" to="/teams">
            Oder zuerst die Prime-Teams entdecken <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
        <HeroCards />
      </section>
      <div className="stat-grid">
        {[
          {
            icon: Shield,
            value: String(catalogStats.teams),
            label: 'Prime-Teams',
            detail: 'Legendäre Saisonmannschaften',
          },
          {
            icon: CalendarDays,
            value: '2007–2026',
            label: '20 Jahrgänge',
            detail: 'Zwei Jahrzehnte Fußballgeschichte',
          },
          {
            icon: UsersRound,
            value: formatNumber(catalogStats.cards),
            label: 'Saisonkarten',
            detail: 'Feste, individuelle Spielwerte',
          },
          {
            icon: Trophy,
            value: '36',
            label: 'Teams pro Turnier',
            detail: 'Das geplante Turnierformat',
          },
        ].map(({ icon: Icon, value, label, detail }) => (
          <div className="stat-card panel" key={label}>
            <span className="stat-icon">
              <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <div>
              <strong>{value}</strong>
              <span>{label}</span>
              <small>{detail}</small>
            </div>
          </div>
        ))}
      </div>
      <div className="dashboard-middle">
        <section className="panel getting-started">
          <div className="section-heading">
            <div>
              <p className="eyebrow">DEIN WEG ZUR TRAUMELF</p>
              <h2>Eine Idee. Elf Legenden.</h2>
            </div>
            <Layers3 size={21} aria-hidden="true" />
          </div>
          <div className="steps">
            <Step
              number="01"
              title="Prime-Teams entdecken"
              text="Lerne die Teams, ihre Stars und ihre Spielwerte kennen."
              done
            />
            <Step
              number="02"
              title="Deine Elf zusammenstellen"
              text="Ziehe zwölf Teams und wähle elf Spieler, einen Coach und deinen Captain."
              done={Boolean(draftStatus?.complete)}
            />
            <Step
              number="03"
              title="Geschichte schreiben"
              text="Später tritt deine Elf im 36-Team-Turnier an."
            />
          </div>
        </section>
        <section className="panel current-status">
          <div className="section-heading">
            <h2>Dein Spielstand</h2>
            <span className="subtle-chip">
              {draftStatus?.complete
                ? 'Aufstellung vollständig'
                : draft
                  ? 'Draft aktiv'
                  : 'Noch nicht gestartet'}
            </span>
          </div>
          <div className="status-row">
            <span className="stat-icon">
              <UsersRound size={20} aria-hidden="true" />
            </span>
            <div>
              <h3>
                {draft
                  ? draftStatus?.complete
                    ? 'Deine Elf steht bereit'
                    : 'Dein Draft läuft'
                  : 'Deine Elf wartet auf dich'}
              </h3>
              <p>
                {draft
                  ? `${draft.picks.length} / 11 Spieler · ${draft.coachCardId ? 'Coach gewählt' : 'Coach offen'} · ${draft.formationId}`
                  : 'Noch kein Team zusammengestellt'}
              </p>
            </div>
            <Link to="/team-builder" aria-label="Aufstellung öffnen">
              <ChevronRight size={18} />
            </Link>
          </div>
          <div className="status-row">
            <span className="stat-icon">
              <Trophy size={20} aria-hidden="true" />
            </span>
            <div>
              <h3>Noch kein Turnier</h3>
              <p>Beginnt mit deinem vollständigen Team</p>
            </div>
          </div>
          <Link className="text-link" to="/team-builder">
            Aufstellung ansehen <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </section>
      </div>
      <section className="featured-teams">
        <div className="section-heading">
          <div>
            <p className="eyebrow">ZEITLOSE MANNSCHAFTEN</p>
            <h2>Große Namen. Große Spielzeiten.</h2>
          </div>
          <Link className="text-link" to="/teams">
            Alle {catalogStats.teams} Teams <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
        <div className="team-grid team-grid--featured">
          {featuredTeamIds.map((id) => (
            <TeamCard key={id} team={teams.find((team) => team.id === id)!} />
          ))}
        </div>
      </section>
    </>
  );
}
