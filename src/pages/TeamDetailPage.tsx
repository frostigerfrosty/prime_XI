import { ArrowLeft, Flag, UserRound, UsersRound } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { countries, formations, teams } from '../app/catalog.ts';
import { Pitch } from '../components/Pitch.tsx';
import { CatalogNote, ClubBadge } from '../components/ui.tsx';
import { formatNumber, initials } from '../utils/display.ts';

export default function TeamDetailPage() {
  const { teamId } = useParams();
  const team = teams.find((candidate) => candidate.id === teamId);
  if (!team)
    return (
      <section className="panel no-results">
        <h1>Dieses Team gibt es nicht.</h1>
        <p>Wähle eine Saisonmannschaft aus dem Prime-Katalog.</p>
        <Link className="button button--primary" to="/teams">
          Zum Teamkatalog
        </Link>
      </section>
    );
  const formation = formations.find((candidate) => candidate.id === team.formation);
  const lineup = team.defaultLineup.map((pick) => ({
    slotId: pick.slotId,
    player: team.players.find((player) => player.id === pick.playerId)!,
  }));
  const startingIds = new Set(lineup.map(({ player }) => player.id));
  const captain = team.players.find((player) => player.personId === team.captainPersonId);
  return (
    <>
      <Link className="text-link back-link" to="/teams">
        <ArrowLeft size={16} aria-hidden="true" /> Alle Prime-Teams
      </Link>
      <div className="team-detail-heading">
        <ClubBadge clubId={team.clubId} size="large" />
        <div>
          <p className="eyebrow">PRIME-SAISON {team.season}</p>
          <h1>{team.clubName}</h1>
          <p>
            {team.coach?.name} <span aria-hidden="true">·</span> {team.formation}{' '}
            <span aria-hidden="true">·</span> {team.players.length} Spieler
          </p>
        </div>
        <div className="team-overall">
          <strong>{team.teamRating === null ? '–' : formatNumber(team.teamRating)}</strong>
          <span>Ø STANDARD­ELF</span>
        </div>
      </div>
      <CatalogNote />
      <Link className="text-link back-link" to={`/compare?left=${team.id}`}>
        {team.clubName} {team.season} vergleichen
      </Link>
      <div className="detail-summary">
        <span>
          <UserRound size={16} aria-hidden="true" />
          <span>
            Coach <strong>{team.coach?.name}</strong>
          </span>
        </span>
        <span>
          <Flag size={16} aria-hidden="true" />
          <span>
            Captain <strong>{captain?.name ?? 'Offen'}</strong>
          </span>
        </span>
        <span>
          <UsersRound size={16} aria-hidden="true" />
          <span>
            Kader <strong>11 Startelf + 7 Optionen</strong>
          </span>
        </span>
      </div>
      <div className="team-detail-grid">
        {formation && (
          <section className="panel lineup-panel">
            <div className="section-heading">
              <h2>Standardaufstellung</h2>
              <span className="season-tag">{formation.id}</span>
            </div>
            <Pitch formation={formation} lineup={lineup} />
            <p className="detail-footnote">
              Redaktionelle Spielaufstellung, keine historische Matchaufstellung.
            </p>
          </section>
        )}
        <section className="panel roster-panel">
          <div className="section-heading">
            <h2>Der Saisonkader</h2>
            <span className="subtle-chip">18 Spieler</span>
          </div>
          <div className="roster-table-wrap">
            <table className="roster-table">
              <caption className="sr-only">
                Saisonkader {team.clubName} {team.season}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Pos.</th>
                  <th scope="col">Spieler</th>
                  <th scope="col">Rolle</th>
                  <th scope="col">OVR</th>
                </tr>
              </thead>
              <tbody>
                {team.players.map((player) => (
                  <tr key={player.id}>
                    <td>
                      <span className="position-label">{player.position}</span>
                    </td>
                    <th scope="row">
                      <span className="roster-person">
                        <span className="avatar" aria-hidden="true">
                          {initials(player.name)}
                        </span>
                        <span>
                          <span className="player-name">
                            {player.name}{' '}
                            {player.naturalCaptain && <abbr title="Natural Captain">C</abbr>}
                          </span>
                          <small>
                            {countries.find((country) => country.id === player.nationality)
                              ?.label ?? player.nationality}
                          </small>
                        </span>
                      </span>
                    </th>
                    <td>
                      <span className="roster-role">
                        {startingIds.has(player.id) ? 'Startelf' : 'Option'}
                      </span>
                    </td>
                    <td className="roster-rating">{player.rating}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
