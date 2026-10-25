import { t, useLanguage } from '../i18n/react.ts';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Check,
  Dices,
  Flag,
  LockKeyhole,
  Save,
  Search,
  Trash2,
  Trophy,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { builder, useDraft } from '../app/DraftProvider.tsx';
import { formations, tactics } from '../app/catalog.ts';
import { Pitch } from '../components/Pitch.tsx';
import { StrengthPanel } from '../components/StrengthPanel.tsx';
import { gameRules } from '../app/game.ts';
import { useTournament } from '../app/TournamentProvider.tsx';
import { CatalogNote, ClubBadge, PageHeading } from '../components/ui.tsx';
import { getGameRules } from '../data/index.ts';
import type { FormationId } from '../types/database.ts';
import { formatNumber, formatStrength, initials } from '../utils/display.ts';
type Confirmation =
  | {
      kind: 'redraw';
    }
  | {
      kind: 'player';
      slotId: string;
      cardId: string;
    }
  | {
      kind: 'tournament';
    }
  | {
      kind: 'formation';
      formationId: FormationId;
      names: string[];
    };
const normalize = (value: string) =>
  value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('de');
export default function BuilderPage() {
  useLanguage();
  const {
    draft,
    warning,
    saved,
    assessment,
    currentTeam,
    teamPersisted,
    teamMatchesDraft,
    teamWarning,
    start,
    dispatch,
    save,
    saveForTournament,
  } = useDraft();
  const { tournament, start: startTournament } = useTournament();
  const navigate = useNavigate();
  const [initialFormation, setInitialFormation] = useState(
    () => getGameRules().builder.defaultFormation,
  );
  const [selectedSlot, setSelectedSlot] = useState('gk-1');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const pickerHeading = useRef<HTMLHeadingElement>(null);
  const sequential = draft?.mode === 'sequential';
  const formation = formations.find(
    (item) => item.id === (draft?.formationId ?? initialFormation),
  )!;
  const slot =
    formation.slots.find(
      (item) =>
        item.id === selectedSlot &&
        (!sequential || !draft?.picks.some((pick) => pick.slotId === item.id)),
    ) ??
    formation.slots.find((item) => !draft?.picks.some((pick) => pick.slotId === item.id)) ??
    formation.slots[0]!;
  const pool = draft?.drawnPrimeTeamIds.map((id) => builder.team(id)!) ?? [];
  const activeTeam =
    draft && sequential
      ? builder.currentTeam(draft)
      : (pool.find((team) => team.id === selectedTeam) ?? pool[0]);
  const lineup = draft ? builder.lineup(draft) : [];
  const status = draft ? builder.status(draft) : null;
  const currentPick = lineup.find((entry) => entry.slotId === slot.id)?.player;
  const coach = draft?.coachCardId ? builder.coach(draft.coachCardId) : null;
  const captain = lineup.find((entry) => entry.player.personId === draft?.captainPersonId)?.player;
  const options = useMemo(() => {
    if (!draft || !activeTeam) return [];
    return activeTeam.players
      .map((player) => ({ player, issue: builder.playerIssue(draft, slot.id, player.id) }))
      .filter(({ player }) =>
        normalize(
          `${player.name} ${player.position} ${player.secondaryPositions.join(' ')}`,
        ).includes(normalize(search)),
      )
      .sort(
        (a, b) =>
          Number(Boolean(a.issue)) - Number(Boolean(b.issue)) || b.player.rating - a.player.rating,
      );
  }, [draft, activeTeam, slot.id, search]);
  useEffect(() => {
    if (confirmation) dialog.current?.showModal();
    else dialog.current?.close();
  }, [confirmation]);
  function attempt(action: () => void, success = '') {
    try {
      action();
      setError('');
      setMessage(success);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Die Auswahl konnte nicht übernommen werden.',
      );
    }
  }
  function draw() {
    attempt(() => {
      start(formation.id);
      setSelectedSlot('gk-1');
      setSelectedTeam('');
      setSearch('');
    }, 'Dein erstes Team ist aufgedeckt. Wähle einen Spieler und eine freie Position.');
  }
  function changeFormation(id: FormationId) {
    if (!draft) {
      setInitialFormation(id);
      return;
    }
    attempt(() => {
      const preview = builder.change(draft, { type: 'formation', formationId: id });
      const removed = lineup.filter(
        (entry) => !preview.picks.some((pick) => pick.playerCardId === entry.player.id),
      );
      if (removed.length)
        setConfirmation({
          kind: 'formation',
          formationId: id,
          names: removed.map((entry) => entry.player.name),
        });
      else {
        dispatch({ type: 'formation', formationId: id });
        setSelectedSlot('gk-1');
      }
    });
  }
  function confirm() {
    const pending = confirmation;
    setConfirmation(null);
    if (pending?.kind === 'redraw') draw();
    else if (pending?.kind === 'player')
      attempt(
        () => {
          dispatch({ type: 'player', slotId: pending.slotId, cardId: pending.cardId });
          setSearch('');
          setSelectedSlot(
            formation.slots.find(
              (item) =>
                item.id !== pending.slotId && !draft?.picks.some((pick) => pick.slotId === item.id),
            )?.id ?? 'gk-1',
          );
          requestAnimationFrame(() => pickerHeading.current?.focus());
        },
        `${builder.player(pending.cardId)?.name} bestätigt. Dieser Pick ist gesperrt.`,
      );
    else if (pending?.kind === 'tournament') launchTournament(true);
    else if (pending?.kind === 'formation')
      attempt(() => {
        dispatch({ type: 'formation', formationId: pending.formationId });
        setSelectedSlot('gk-1');
      }, 'Formation geändert. Die übrigen Spieler bleiben erhalten.');
  }
  function launchTournament(replace = false) {
    attempt(() => {
      startTournament(saveForTournament(), crypto.randomUUID(), replace);
      navigate('/tournament');
    });
  }
  return (
    <>
      <div className="builder-page-heading">
        <PageHeading
          eyebrow={t('DEINE IDEEN. DEINE AUFSTELLUNG.')}
          title={t('Team Builder')}
          description={t('Ein Team nach dem anderen. Elf feste Entscheidungen. Deine Prime XI.')}
        />
        <button
          className="button button--secondary"
          onClick={() =>
            draft && (draft.picks.length || draft.coachCardId)
              ? setConfirmation({ kind: 'redraw' })
              : draw()
          }
        >
          <Dices size={17} aria-hidden="true" />
          {t(draft ? 'Neuer Draft' : 'Draft starten')}
        </button>
      </div>
      <CatalogNote />
      {warning && (
        <p className="builder-alert" role="alert">
          {t(warning)}
        </p>
      )}
      {teamWarning && (
        <p className="builder-alert" role="alert">
          {t(teamWarning)}
        </p>
      )}
      {error && (
        <p className="builder-alert builder-alert--error" role="alert">
          {t(error)}
        </p>
      )}
      <p className="builder-feedback" role="status">
        {t(
          message ||
            (draft
              ? saved
                ? 'Dein Draft wird automatisch in diesem Browser gespeichert.'
                : 'Dein Draft ist für diese Sitzung aktiv.'
              : 'Wähle deine Formation und starte den verdeckten Draft.'),
        )}
      </p>
      {draft && !sequential && (
        <p className="picker-hint">
          {t(
            'Dieser vorhandene Draft verwendet noch den bisherigen offenen Pool. Ein neuer Draft startet mit verdeckter Teamfolge.',
          )}
        </p>
      )}
      <div className="builder-grid builder-grid--active">
        <section className="panel lineup-panel">
          <div className="section-heading">
            <h2>{t('Deine Aufstellung')}</h2>
            <label className="formation-select">
              <span>{t('Formation')}</span>
              <select
                value={formation.id}
                disabled={Boolean(sequential && draft?.picks.length)}
                onChange={(event) => changeFormation(event.target.value as FormationId)}
              >
                {formations.map((item) => (
                  <option key={item.id}>{item.id}</option>
                ))}
              </select>
            </label>
          </div>
          {draft ? (
            <Pitch
              formation={formation}
              lineup={lineup}
              selectedSlotId={slot.id}
              captainPersonId={draft.captainPersonId}
              onSelect={(id) => {
                setSelectedSlot(id);
                setMessage('');
              }}
              lockedSlots={sequential ? draft.picks.map((pick) => pick.slotId) : []}
            />
          ) : (
            <Pitch formation={formation} />
          )}
          <div className="lineup-footer">
            <span>
              <UsersRound size={16} aria-hidden="true" />
              <strong>{lineup.length} / 11</strong>
              {t(' Spieler')}
            </span>
            <span>
              <UserRound size={16} aria-hidden="true" />
              <strong>{coach ? 1 : 0} / 1</strong>
              {t(' Coach')}
            </span>
            <span>
              {t('\u00D8 Kartenrating')}
              {t(' ')}
              <strong>
                {t(status?.averageRating == null ? '–' : formatNumber(status.averageRating))}
              </strong>
            </span>
            <span>
              {t('Matchst\u00E4rke')}
              {t(' ')}
              <strong className="match-value">
                {t(assessment ? formatStrength(assessment.strength.matchStrength) : '–')}
              </strong>
            </span>
          </div>
          {draft && (
            <div className="builder-tactic">
              <label htmlFor="builder-tactic">{t('Deine Taktik')}</label>
              <select
                id="builder-tactic"
                value={draft.tacticId}
                onChange={(event) =>
                  attempt(() => dispatch({ type: 'tactic', tacticId: event.target.value }))
                }
              >
                {tactics.map((tactic) => (
                  <option key={tactic.id} value={tactic.id}>
                    {t(tactic.label)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>
        {draft && sequential && lineup.length === 11 ? (
          <section className="panel draft-panel builder-start">
            <Check size={34} aria-hidden="true" />
            <h2 ref={pickerHeading} tabIndex={-1}>
              {t('Elf Picks best\u00E4tigt.')}
            </h2>
            <p>
              {t(
                'Alle Spieler und Positionen sind fest. W\u00E4hle noch Coach und Captain, um deine Prime XI zu speichern.',
              )}
            </p>
          </section>
        ) : draft && activeTeam ? (
          <section className="panel player-picker" aria-label={t('Spielerauswahl')}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">
                  {t(sequential ? `Team ${lineup.length + 1} von 11` : 'DEIN NÄCHSTER PICK')}
                </p>
                <h2 ref={pickerHeading} tabIndex={-1}>
                  {t(sequential ? `${activeTeam.clubName} ${activeTeam.season}` : 'Spieler wählen')}
                </h2>
              </div>
              <span className="subtle-chip">{lineup.length} / 11</span>
            </div>
            <label className="builder-field">
              <span>{t('Position w\u00E4hlen')}</span>
              <select value={slot.id} onChange={(event) => setSelectedSlot(event.target.value)}>
                {formation.slots.map((item, index) => {
                  const player = lineup.find((entry) => entry.slotId === item.id)?.player;
                  return (
                    <option key={item.id} value={item.id} disabled={Boolean(sequential && player)}>
                      {item.acceptedPositions[0]}
                      {t(' \u00B7 Position ')}
                      {index + 1}
                      {t(player ? ` · ${player.name}` : ' · Offen')}
                    </option>
                  );
                })}
              </select>
            </label>
            {!sequential && (
              <label className="builder-field">
                <span>{t('Prime-Team')}</span>
                <select
                  value={activeTeam.id}
                  onChange={(event) => {
                    setSelectedTeam(event.target.value);
                    setSearch('');
                  }}
                >
                  {pool.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.clubName} {team.season}
                      {t(
                        lineup.some((entry) => entry.player.primeTeamId === team.id)
                          ? ' · Spieler gewählt'
                          : '',
                      )}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="search-input builder-search">
              <Search size={16} aria-hidden="true" />
              <span className="sr-only">{t('Spieler suchen')}</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('Name oder Position …')}
              />
            </label>
            {currentPick && !sequential && (
              <div className="current-pick">
                <span>
                  <small>{t('AUF DIESER POSITION')}</small>
                  <strong>{currentPick.name}</strong>
                </span>
                <button
                  className="icon-button"
                  aria-label={t(`${currentPick.name} entfernen`)}
                  onClick={() =>
                    attempt(
                      () => dispatch({ type: 'remove', slotId: slot.id }),
                      `${currentPick.name} entfernt.`,
                    )
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
            <p className="picker-hint">
              {t(
                sequential
                  ? 'Bestätigte Picks und die Formation bleiben fest. Wähle eine Karte für '
                  : 'Ein Spieler pro Saisonteam. Wähle eine Karte für ',
              )}
              <strong>{t(slot.acceptedPositions.join(' / '))}</strong>.
            </p>
            <ul className="player-options" tabIndex={0} aria-label={t('Spielerkarten')}>
              {options.map(({ player, issue }) => {
                const selected = currentPick?.id === player.id;
                return (
                  <li
                    key={player.id}
                    className={issue ? 'player-option player-option--blocked' : 'player-option'}
                  >
                    <span className="position-label">{player.position}</span>
                    <span className="avatar" aria-hidden="true">
                      {t(initials(player.name))}
                    </span>
                    <div className="player-option-name">
                      <strong>
                        {player.name}
                        {t(' ')}
                        {player.naturalCaptain && (
                          <abbr title={t('Natural Captain')}>{t('C')}</abbr>
                        )}
                      </strong>
                      <small>
                        {t(
                          selected
                            ? 'Auf dieser Position gewählt'
                            : (issue ??
                                (slot.acceptedPositions.includes(player.position)
                                  ? 'Hauptposition'
                                  : `Nebenposition · ${formatNumber(gameRules.strength.positionFit.secondaryMultiplier * 100)} % Wirkung`)),
                        )}
                      </small>
                    </div>
                    <strong className="roster-rating">{player.rating}</strong>
                    <button
                      className="pick-button"
                      disabled={Boolean(issue) || selected}
                      aria-label={t(`Wählen: ${player.name}`)}
                      onClick={() =>
                        attempt(
                          () =>
                            sequential
                              ? setConfirmation({
                                  kind: 'player',
                                  slotId: slot.id,
                                  cardId: player.id,
                                })
                              : dispatch({ type: 'player', slotId: slot.id, cardId: player.id }),
                          sequential
                            ? ''
                            : `${player.name} auf ${slot.acceptedPositions[0]} gewählt.`,
                        )
                      }
                    >
                      {selected ? <Check size={16} aria-label={t('Gewählt')} /> : 'Wählen'}
                    </button>
                  </li>
                );
              })}
            </ul>
            {!options.length && (
              <p className="picker-hint">
                {t('Keine passenden Suchergebnisse. Versuche einen anderen Namen.')}
              </p>
            )}
          </section>
        ) : (
          <section className="panel draft-panel builder-start">
            <div className="draft-icon">
              <Dices size={34} strokeWidth={1.2} aria-hidden="true" />
            </div>
            <p className="eyebrow">{t('DEIN DRAFT BEGINNT HIER')}</p>
            <h2>
              {t('Die n\u00E4chste Legende')}
              <br />
              {t('wartet auf dich.')}
            </h2>
            <p>
              {t(
                'Entdecke elf unterschiedliche Saisonmannschaften nacheinander. W\u00E4hle pro Team einen Spieler und best\u00E4tige seine Position. Erst dann erscheint das n\u00E4chste Team. Dein Coach ist ein separater Pick aus den aufgedeckten Teams.',
              )}
            </p>
            <button className="button button--primary" onClick={draw}>
              <Dices size={17} aria-hidden="true" />
              {t('Erstes Team aufdecken')}
            </button>
            <button className="button button--locked" disabled>
              <LockKeyhole size={15} aria-hidden="true" />
              {t('Team speichern & Turnier starten')}
            </button>
          </section>
        )}
      </div>
      <StrengthPanel />
      {draft ? (
        <>
          <section className="panel drawn-teams-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{t('DEINE AUSWAHL')}</p>
                <h2>
                  {t(sequential ? 'Bestätigte Teams' : 'Gezogene Teams')}
                  {t(' ')}
                  <span>
                    ({sequential ? lineup.length : pool.length} / {sequential ? 11 : 12})
                  </span>
                </h2>
              </div>
              <span className="subtle-chip">
                {lineup.length}
                {t(' Spieler gew\u00E4hlt')}
              </span>
            </div>
            <div className="drawn-teams">
              {(sequential ? pool.slice(0, lineup.length) : pool).map((team, index) => {
                const player = lineup.find((entry) => entry.player.primeTeamId === team.id)?.player;
                return (
                  <button
                    key={team.id}
                    className={`drawn-team ${activeTeam?.id === team.id ? 'drawn-team--active' : ''}`}
                    aria-pressed={activeTeam?.id === team.id}
                    aria-label={t(
                      `${team.clubName} ${team.season}${player ? ` · ${player.name} gewählt` : ' · Noch kein Spieler'}`,
                    )}
                    disabled={sequential}
                    onClick={() => {
                      setSelectedTeam(team.id);
                      setSearch('');
                    }}
                  >
                    <span className="draw-number">{index + 1}</span>
                    <ClubBadge clubId={team.clubId} />
                    <strong>{team.clubName}</strong>
                    <span>{team.season}</span>
                    <small>
                      {player ? (
                        <>
                          <Check size={12} aria-hidden="true" />
                          {player.name}
                        </>
                      ) : (
                        'Pick offen'
                      )}
                    </small>
                  </button>
                );
              })}
            </div>
          </section>
          <div className="builder-bottom">
            <section className="panel builder-coach">
              <p className="eyebrow">{t('DIE IDEE HINTER DEINER ELF')}</p>
              <h2>{t('Coach & Captain')}</h2>
              <label className="builder-field">
                <span>{t('Coach w\u00E4hlen')}</span>
                <select
                  value={draft.coachCardId ?? ''}
                  onChange={(event) =>
                    attempt(() => dispatch({ type: 'coach', cardId: event.target.value || null }))
                  }
                >
                  <option value="">{t('Noch kein Coach gew\u00E4hlt')}</option>
                  {pool.map(
                    (team) =>
                      team.coach && (
                        <option key={team.coach.id} value={team.coach.id}>
                          {team.coach.name} · {team.clubName} {team.season}
                        </option>
                      ),
                  )}
                </select>
              </label>
              {coach && (
                <p className="coach-selected">
                  <span className="avatar" aria-hidden="true">
                    {t(initials(coach.name))}
                  </span>
                  <span>
                    <strong>{coach.name}</strong>
                    <small>{t('Separater Pick \u00B7 verbraucht keinen Spielerplatz')}</small>
                  </span>
                </p>
              )}
              <label className="builder-field">
                <span>{t('Captain w\u00E4hlen')}</span>
                <select
                  value={draft.captainPersonId ?? ''}
                  disabled={!lineup.length}
                  onChange={(event) => {
                    if (event.target.value)
                      attempt(() => dispatch({ type: 'captain', personId: event.target.value }));
                  }}
                >
                  <option value="" disabled>
                    {t('Captain aus deiner Elf w\u00E4hlen')}
                  </option>
                  {lineup.map(({ player }) => (
                    <option key={player.personId} value={player.personId}>
                      {player.name}
                      {t(player.naturalCaptain ? ' · Natural Captain' : '')}
                    </option>
                  ))}
                </select>
              </label>
              <p className="picker-hint">
                <Flag size={13} aria-hidden="true" />
                {t(
                  captain
                    ? `${captain.name}${captain.naturalCaptain ? ' ist ein Natural Captain.' : ' führt deine Elf an.'}`
                    : 'Ein Natural Captain wird automatisch vorgeschlagen, sobald du ihn aufstellst.',
                )}
              </p>
            </section>
            <section
              className={`panel builder-completion ${status?.complete ? 'builder-completion--ready' : ''}`}
            >
              <p className="eyebrow">{t('DEIN TEAMSTATUS')}</p>
              <h2>{t(status?.complete ? 'Deine Elf steht.' : 'Jeder Pick zählt.')}</h2>
              <ul>
                <li>
                  <span>
                    {lineup.length === 11 ? <Check size={16} /> : <UsersRound size={16} />}
                  </span>
                  {lineup.length}
                  {t(' von 11 Spielern auf g\u00FCltigen Positionen')}
                </li>
                <li>
                  <span>{coach ? <Check size={16} /> : <UserRound size={16} />}</span>
                  {t(coach ? 'Coach gewählt' : 'Noch einen Coach wählen')}
                </li>
                <li>
                  <span>{captain ? <Check size={16} /> : <Flag size={16} />}</span>
                  {t(captain ? `Captain: ${captain.name}` : 'Noch einen Captain wählen')}
                </li>
              </ul>
              <button
                className="button button--primary"
                disabled={!status?.complete}
                onClick={() =>
                  attempt(() => {
                    if (!save())
                      throw new Error(
                        'Deine Elf bleibt für diese Sitzung erhalten, konnte aber nicht im Browser gespeichert werden.',
                      );
                  }, 'Aufstellung gespeichert. Spielerwerte und berechnete Matchstärke sind gesichert.')
                }
              >
                <Save size={16} aria-hidden="true" />
                {t('Aufstellung speichern')}
              </button>
              {currentTeam && (
                <p className="team-save-state">
                  {t(
                    teamMatchesDraft
                      ? teamPersisted
                        ? 'Diese Elf ist mit ihren aktuellen Spielerwerten und Boni gespeichert.'
                        : 'Diese Elf bleibt nur für die aktuelle Sitzung erhalten.'
                      : 'Du bearbeitest einen anderen Stand. Deine zuletzt gespeicherte Elf bleibt erhalten, bis du erneut speicherst.',
                  )}
                </p>
              )}
              {currentTeam && (
                <Link className="text-link" to="/test-match">
                  {t('Gespeicherte Elf im Testspiel ausprobieren')}
                </Link>
              )}
              <button
                className="button button--primary"
                disabled={!status?.complete}
                onClick={() =>
                  tournament ? setConfirmation({ kind: 'tournament' }) : launchTournament()
                }
              >
                <Trophy size={15} aria-hidden="true" />
                {t('Team speichern & Turnier starten')}
              </button>
              <p className="picker-hint">
                {t(
                  saved
                    ? 'Dein Draft bleibt beim Neuladen erhalten.'
                    : 'Dein Draft ist momentan nur für diese Sitzung gesichert.',
                )}
                {t(' ')}
                {t('Liga, Playoffs und K.-o.-Runden bis zum Finale sind spielbar.')}
              </p>
            </section>
          </div>
        </>
      ) : (
        <section className="panel draft-empty-strip">
          <div>
            <p className="eyebrow">{t('DEIN SPIELPLAN')}</p>
            <h2>{t('Erst die Idee. Dann die Elf.')}</h2>
            <p>
              {t(
                'K\u00FCnftige Teams bleiben verborgen. Best\u00E4tigte Spieler und Positionen sind fest. Ein neuer Draft ersetzt deine Auswahl erst nach Best\u00E4tigung.',
              )}
            </p>
          </div>
        </section>
      )}
      <dialog
        className="builder-confirm"
        ref={dialog}
        aria-labelledby="draft-confirm-title"
        onCancel={() => setConfirmation(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setConfirmation(null);
        }}
      >
        <h2 id="draft-confirm-title">
          {t(
            confirmation?.kind === 'redraw'
              ? 'Einen neuen Draft starten?'
              : confirmation?.kind === 'player'
                ? 'Spieler und Position bestätigen?'
                : confirmation?.kind === 'tournament'
                  ? 'Bisheriges Turnier ersetzen?'
                  : 'Formation wirklich ändern?',
          )}
        </h2>
        <p>
          {t(
            confirmation?.kind === 'redraw'
              ? 'Dein bisheriger Pool, Spieler, Coach und Captain werden ersetzt. Dieser Schritt kann nicht rückgängig gemacht werden.'
              : confirmation?.kind === 'player'
                ? `${builder.player(confirmation.cardId)?.name} auf ${formation.slots.find((item) => item.id === confirmation.slotId)?.acceptedPositions.join(' / ')} festlegen? Dieser Pick kann nicht geändert oder entfernt werden. Anschließend wird das nächste Team aufgedeckt; nach dem elften Pick ist deine Auswahl abgeschlossen.`
                : confirmation?.kind === 'tournament'
                  ? tournament?.phase === 'completed'
                    ? 'Dein abgeschlossener Turnierrückblick bleibt im Archiv erhalten. Dein aktueller Draft wird als neue Turnier-Elf gespeichert.'
                    : 'Dein bisheriger Spielplan und alle Ergebnisse werden ersetzt. Dein aktueller Draft wird als neue Turnier-Elf gespeichert.'
                  : `Diese Spieler passen nicht mehr in die neue Aufstellung und werden entfernt: ${confirmation?.kind === 'formation' ? confirmation.names.join(', ') : ''}. Alle anderen Picks bleiben erhalten.`,
          )}
        </p>
        <div>
          <button className="button button--secondary" onClick={() => setConfirmation(null)}>
            {t('Abbrechen')}
          </button>
          <button className="button button--primary" onClick={confirm}>
            {t('Best\u00E4tigen')}
          </button>
        </div>
      </dialog>
    </>
  );
}
