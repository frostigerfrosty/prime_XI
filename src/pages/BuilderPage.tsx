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
  | { kind: 'redraw' }
  | { kind: 'tournament' }
  | { kind: 'formation'; formationId: FormationId; names: string[] };
const normalize = (value: string) =>
  value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('de');

export default function BuilderPage() {
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
  const formation = formations.find(
    (item) => item.id === (draft?.formationId ?? initialFormation),
  )!;
  const slot = formation.slots.find((item) => item.id === selectedSlot) ?? formation.slots[0]!;
  const pool = draft?.drawnPrimeTeamIds.map((id) => builder.team(id)!) ?? [];
  const activeTeam = pool.find((team) => team.id === selectedTeam) ?? pool[0];
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
    }, 'Zwölf unterschiedliche Prime-Teams gezogen. Wähle eine Position und deinen ersten Spieler.');
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
          eyebrow="DEINE IDEEN. DEINE AUFSTELLUNG."
          title="Team Builder"
          description="Zwölf Prime-Teams. Elf Spieler. Dein Plan für die große Bühne."
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
          {draft ? 'Neuer Draft' : '12 Teams ziehen'}
        </button>
      </div>
      <CatalogNote />
      {warning && (
        <p className="builder-alert" role="alert">
          {warning}
        </p>
      )}
      {teamWarning && (
        <p className="builder-alert" role="alert">
          {teamWarning}
        </p>
      )}
      {error && (
        <p className="builder-alert builder-alert--error" role="alert">
          {error}
        </p>
      )}
      <p className="builder-feedback" role="status">
        {message ||
          (draft
            ? saved
              ? 'Dein Draft wird automatisch in diesem Browser gespeichert.'
              : 'Dein Draft ist für diese Sitzung aktiv.'
            : 'Wähle eine Formation und ziehe anschließend deine Teams.')}
      </p>
      <div className="builder-grid builder-grid--active">
        <section className="panel lineup-panel">
          <div className="section-heading">
            <h2>Deine Aufstellung</h2>
            <label className="formation-select">
              <span>Formation</span>
              <select
                value={formation.id}
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
            />
          ) : (
            <Pitch formation={formation} />
          )}
          <div className="lineup-footer">
            <span>
              <UsersRound size={16} aria-hidden="true" />
              <strong>{lineup.length} / 11</strong> Spieler
            </span>
            <span>
              <UserRound size={16} aria-hidden="true" />
              <strong>{coach ? 1 : 0} / 1</strong> Coach
            </span>
            <span>
              Ø Kartenrating{' '}
              <strong>
                {status?.averageRating == null ? '–' : formatNumber(status.averageRating)}
              </strong>
            </span>
            <span>
              Matchstärke{' '}
              <strong className="match-value">
                {assessment ? formatStrength(assessment.strength.matchStrength) : '–'}
              </strong>
            </span>
          </div>
          {draft && (
            <div className="builder-tactic">
              <label htmlFor="builder-tactic">Deine Taktik</label>
              <select
                id="builder-tactic"
                value={draft.tacticId}
                onChange={(event) =>
                  attempt(() => dispatch({ type: 'tactic', tacticId: event.target.value }))
                }
              >
                {tactics.map((tactic) => (
                  <option key={tactic.id} value={tactic.id}>
                    {tactic.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>
        {draft && activeTeam ? (
          <section className="panel player-picker" aria-label="Spielerauswahl">
            <div className="section-heading">
              <div>
                <p className="eyebrow">DEIN NÄCHSTER PICK</p>
                <h2>Spieler wählen</h2>
              </div>
              <span className="subtle-chip">{lineup.length} / 11</span>
            </div>
            <label className="builder-field">
              <span>Position wählen</span>
              <select value={slot.id} onChange={(event) => setSelectedSlot(event.target.value)}>
                {formation.slots.map((item, index) => {
                  const player = lineup.find((entry) => entry.slotId === item.id)?.player;
                  return (
                    <option key={item.id} value={item.id}>
                      {item.acceptedPositions[0]} · Position {index + 1}
                      {player ? ` · ${player.name}` : ' · Offen'}
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="builder-field">
              <span>Prime-Team</span>
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
                    {lineup.some((entry) => entry.player.primeTeamId === team.id)
                      ? ' · Spieler gewählt'
                      : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="search-input builder-search">
              <Search size={16} aria-hidden="true" />
              <span className="sr-only">Spieler suchen</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name oder Position …"
              />
            </label>
            {currentPick && (
              <div className="current-pick">
                <span>
                  <small>AUF DIESER POSITION</small>
                  <strong>{currentPick.name}</strong>
                </span>
                <button
                  className="icon-button"
                  aria-label={`${currentPick.name} entfernen`}
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
              Ein Spieler pro Saisonteam. Wähle eine Karte für{' '}
              <strong>{slot.acceptedPositions.join(' / ')}</strong>.
            </p>
            <ul className="player-options" tabIndex={0} aria-label="Spielerkarten">
              {options.map(({ player, issue }) => {
                const selected = currentPick?.id === player.id;
                return (
                  <li
                    key={player.id}
                    className={issue ? 'player-option player-option--blocked' : 'player-option'}
                  >
                    <span className="position-label">{player.position}</span>
                    <span className="avatar" aria-hidden="true">
                      {initials(player.name)}
                    </span>
                    <div className="player-option-name">
                      <strong>
                        {player.name}{' '}
                        {player.naturalCaptain && <abbr title="Natural Captain">C</abbr>}
                      </strong>
                      <small>
                        {selected
                          ? 'Auf dieser Position gewählt'
                          : (issue ??
                            (slot.acceptedPositions.includes(player.position)
                              ? 'Hauptposition'
                              : `Nebenposition · ${formatNumber(gameRules.strength.positionFit.secondaryMultiplier * 100)} % Wirkung`))}
                      </small>
                    </div>
                    <strong className="roster-rating">{player.rating}</strong>
                    <button
                      className="pick-button"
                      disabled={Boolean(issue) || selected}
                      aria-label={`Wählen: ${player.name}`}
                      onClick={() =>
                        attempt(
                          () => dispatch({ type: 'player', slotId: slot.id, cardId: player.id }),
                          `${player.name} auf ${slot.acceptedPositions[0]} gewählt.`,
                        )
                      }
                    >
                      {selected ? <Check size={16} aria-label="Gewählt" /> : 'Wählen'}
                    </button>
                  </li>
                );
              })}
            </ul>
            {!options.length && (
              <p className="picker-hint">
                Keine passenden Suchergebnisse. Versuche einen anderen Namen.
              </p>
            )}
          </section>
        ) : (
          <section className="panel draft-panel builder-start">
            <div className="draft-icon">
              <Dices size={34} strokeWidth={1.2} aria-hidden="true" />
            </div>
            <p className="eyebrow">DEIN DRAFT BEGINNT HIER</p>
            <h2>
              Die nächste Legende
              <br />
              wartet auf dich.
            </h2>
            <p>
              Ziehe zwölf unterschiedliche Saisonmannschaften. Aus elf davon wählst du je einen
              Spieler. Dein Coach ist ein eigener Pick.
            </p>
            <button className="button button--primary" onClick={draw}>
              <Dices size={17} aria-hidden="true" />
              Draft starten
            </button>
            <button className="button button--locked" disabled>
              <LockKeyhole size={15} aria-hidden="true" />
              Team speichern & Turnier starten
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
                <p className="eyebrow">DEINE AUSWAHL</p>
                <h2>
                  Gezogene Teams <span>({pool.length} / 12)</span>
                </h2>
              </div>
              <span className="subtle-chip">{lineup.length} Spieler gewählt</span>
            </div>
            <div className="drawn-teams">
              {pool.map((team, index) => {
                const player = lineup.find((entry) => entry.player.primeTeamId === team.id)?.player;
                return (
                  <button
                    key={team.id}
                    className={`drawn-team ${activeTeam?.id === team.id ? 'drawn-team--active' : ''}`}
                    aria-pressed={activeTeam?.id === team.id}
                    aria-label={`${team.clubName} ${team.season}${player ? ` · ${player.name} gewählt` : ' · Noch kein Spieler'}`}
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
              <p className="eyebrow">DIE IDEE HINTER DEINER ELF</p>
              <h2>Coach & Captain</h2>
              <label className="builder-field">
                <span>Coach wählen</span>
                <select
                  value={draft.coachCardId ?? ''}
                  onChange={(event) =>
                    attempt(() => dispatch({ type: 'coach', cardId: event.target.value || null }))
                  }
                >
                  <option value="">Noch kein Coach gewählt</option>
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
                    {initials(coach.name)}
                  </span>
                  <span>
                    <strong>{coach.name}</strong>
                    <small>Separater Pick · verbraucht keinen Spielerplatz</small>
                  </span>
                </p>
              )}
              <label className="builder-field">
                <span>Captain wählen</span>
                <select
                  value={draft.captainPersonId ?? ''}
                  disabled={!lineup.length}
                  onChange={(event) => {
                    if (event.target.value)
                      attempt(() => dispatch({ type: 'captain', personId: event.target.value }));
                  }}
                >
                  <option value="" disabled>
                    Captain aus deiner Elf wählen
                  </option>
                  {lineup.map(({ player }) => (
                    <option key={player.personId} value={player.personId}>
                      {player.name}
                      {player.naturalCaptain ? ' · Natural Captain' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <p className="picker-hint">
                <Flag size={13} aria-hidden="true" />
                {captain
                  ? `${captain.name}${captain.naturalCaptain ? ' ist ein Natural Captain.' : ' führt deine Elf an.'}`
                  : 'Ein Natural Captain wird automatisch vorgeschlagen, sobald du ihn aufstellst.'}
              </p>
            </section>
            <section
              className={`panel builder-completion ${status?.complete ? 'builder-completion--ready' : ''}`}
            >
              <p className="eyebrow">DEIN TEAMSTATUS</p>
              <h2>{status?.complete ? 'Deine Elf steht.' : 'Jeder Pick zählt.'}</h2>
              <ul>
                <li>
                  <span>
                    {lineup.length === 11 ? <Check size={16} /> : <UsersRound size={16} />}
                  </span>
                  {lineup.length} von 11 Spielern auf gültigen Positionen
                </li>
                <li>
                  <span>{coach ? <Check size={16} /> : <UserRound size={16} />}</span>
                  {coach ? 'Coach gewählt' : 'Noch einen Coach wählen'}
                </li>
                <li>
                  <span>{captain ? <Check size={16} /> : <Flag size={16} />}</span>
                  {captain ? `Captain: ${captain.name}` : 'Noch einen Captain wählen'}
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
                Aufstellung speichern
              </button>
              {currentTeam && (
                <p className="team-save-state">
                  {teamMatchesDraft
                    ? teamPersisted
                      ? 'Diese Elf ist mit ihren aktuellen Spielerwerten und Boni gespeichert.'
                      : 'Diese Elf bleibt nur für die aktuelle Sitzung erhalten.'
                    : 'Du bearbeitest einen anderen Stand. Deine zuletzt gespeicherte Elf bleibt erhalten, bis du erneut speicherst.'}
                </p>
              )}
              {currentTeam && (
                <Link className="text-link" to="/test-match">
                  Gespeicherte Elf im Testspiel ausprobieren
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
                Team speichern & Turnier starten
              </button>
              <p className="picker-hint">
                {saved
                  ? 'Dein Draft bleibt beim Neuladen erhalten.'
                  : 'Dein Draft ist momentan nur für diese Sitzung gesichert.'}{' '}
                Die Ligaphase ist spielbar. Playoffs und K.-o.-Runden folgen in Etappe 7.
              </p>
            </section>
          </div>
        </>
      ) : (
        <section className="panel draft-empty-strip">
          <div>
            <p className="eyebrow">DEIN SPIELPLAN</p>
            <h2>Erst die Idee. Dann die Elf.</h2>
            <p>
              Alle zwölf gezogenen Teams bleiben hier sichtbar. Ein neuer Draft ersetzt deinen
              bisherigen Pool erst nach Bestätigung.
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
          {confirmation?.kind === 'redraw'
            ? 'Einen neuen Draft starten?'
            : confirmation?.kind === 'tournament'
              ? 'Bisheriges Turnier ersetzen?'
              : 'Formation wirklich ändern?'}
        </h2>
        <p>
          {confirmation?.kind === 'redraw'
            ? 'Dein bisheriger Pool, Spieler, Coach und Captain werden ersetzt. Dieser Schritt kann nicht rückgängig gemacht werden.'
            : confirmation?.kind === 'tournament'
              ? 'Dein bisheriger Spielplan und alle Ergebnisse werden ersetzt. Dein aktueller Draft wird als neue Turnier-Elf gespeichert.'
              : `Diese Spieler passen nicht mehr in die neue Aufstellung und werden entfernt: ${confirmation?.kind === 'formation' ? confirmation.names.join(', ') : ''}. Alle anderen Picks bleiben erhalten.`}
        </p>
        <div>
          <button className="button button--secondary" onClick={() => setConfirmation(null)}>
            Abbrechen
          </button>
          <button className="button button--primary" onClick={confirm}>
            Bestätigen
          </button>
        </div>
      </dialog>
    </>
  );
}
