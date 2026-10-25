import { t, useLanguage } from '../i18n/react.ts';
import { ArrowLeft, Flag, UserRound, UsersRound } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { countries, formations, teams } from '../app/catalog.ts';
import { Pitch } from '../components/Pitch.tsx';
import { RatingExplanation } from '../components/RatingExplanation.tsx';
import { CatalogNote, ClubBadge } from '../components/ui.tsx';
import { formatNumber, initials } from '../utils/display.ts';
export default function TeamDetailPage() {
  useLanguage();
  const { teamId } = useParams();
  const team = teams.find((candidate) => candidate.id === teamId);
  if (!team)
    return (
      <section className="panel no-results">
        <h1>{t('Dieses Team gibt es nicht.')}</h1>
        <p>{t('W\u00E4hle eine Saisonmannschaft aus dem Prime-Katalog.')}</p>
        <Link className="button button--primary" to="/teams">
          {t('Zum Teamkatalog')}
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
        <ArrowLeft size={16} aria-hidden="true" />
        {t(' Alle Prime-Teams')}
      </Link>
      <div className="team-detail-heading">
        <ClubBadge clubId={team.clubId} size="large" />
        <div>
          <p className="eyebrow">
            {t('PRIME-SAISON ')}
            {team.season}
          </p>
          <h1>{team.clubName}</h1>
          <p>
            {team.coach?.name} <span aria-hidden="true">·</span> {team.formation}
            {t(' ')}
            <span aria-hidden="true">·</span> {team.players.length}
            {t(' Spieler')}
          </p>
        </div>
        <div className="team-overall">
          <strong>{t(team.teamRating === null ? '–' : formatNumber(team.teamRating))}</strong>
          <span>{t('\u00D8 STANDARD\u00ADELF')}</span>
        </div>
      </div>
      <CatalogNote />
      <Link className="text-link back-link" to={`/compare?left=${team.id}`}>
        {t(`${team.clubName} ${team.season} vergleichen`)}
      </Link>
      <div className="detail-summary">
        <span>
          <UserRound size={16} aria-hidden="true" />
          <span>
            {t('Coach ')}
            <strong>{team.coach?.name}</strong>
          </span>
        </span>
        <span>
          <Flag size={16} aria-hidden="true" />
          <span>
            {t('Captain ')}
            <strong>{t(captain?.name ?? 'Offen')}</strong>
          </span>
        </span>
        <span>
          <UsersRound size={16} aria-hidden="true" />
          <span>
            {t('Kader ')}
            <strong>{t('11 Startelf + 7 Optionen')}</strong>
          </span>
        </span>
      </div>
      <div className="team-detail-grid">
        {formation && (
          <section className="panel lineup-panel">
            <div className="section-heading">
              <h2>{t('Standardaufstellung')}</h2>
              <span className="season-tag">{formation.id}</span>
            </div>
            <Pitch formation={formation} lineup={lineup} />
            <p className="detail-footnote">
              {t('Redaktionelle Spielaufstellung, keine historische Matchaufstellung.')}
            </p>
          </section>
        )}
        <section className="panel roster-panel">
          <div className="section-heading">
            <h2>{t('Der Saisonkader')}</h2>
            <span className="subtle-chip">{t('18 Spieler')}</span>
          </div>
          <div className="roster-table-wrap">
            <table className="roster-table">
              <caption className="sr-only">
                {t('Saisonkader ')}
                {team.clubName} {team.season}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{t('Pos.')}</th>
                  <th scope="col">{t('Spieler')}</th>
                  <th scope="col">{t('Rolle')}</th>
                  <th scope="col">{t('OVR')}</th>
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
                          {t(initials(player.name))}
                        </span>
                        <span>
                          <span className="player-name">
                            {player.name}
                            {t(' ')}
                            {player.naturalCaptain && (
                              <abbr title={t('Natural Captain')}>{t('C')}</abbr>
                            )}
                          </span>
                          <small>
                            {t(
                              countries.find((country) => country.id === player.nationality)
                                ?.label ?? player.nationality,
                            )}
                          </small>
                          <RatingExplanation player={player} />
                        </span>
                      </span>
                    </th>
                    <td>
                      <span className="roster-role">
                        {t(startingIds.has(player.id) ? 'Startelf' : 'Option')}
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
