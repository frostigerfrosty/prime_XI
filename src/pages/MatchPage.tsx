import { useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Dices, Shield, Swords } from 'lucide-react';
import { Link } from 'react-router-dom';
import { teams } from '../app/catalog.ts';
import { useDraft } from '../app/DraftProvider.tsx';
import { matchEngine, strengthModel } from '../app/game.ts';
import { getDefaultSettings } from '../data/index.ts';
import { primeMatchTeam, savedMatchTeam } from '../engine/match-team.ts';
import type { MatchTeam } from '../engine/match.ts';
import type { MatchResult } from '../types/application.ts';
import { CatalogNote, ClubBadge, PageHeading } from '../components/ui.tsx';
import { formatStrength } from '../utils/display.ts';

interface Choice extends MatchTeam {
  name: string;
  detail: string;
  clubId: string | null;
}
const catalog: Choice[] = teams.map((team) => ({
  ...primeMatchTeam(team, strengthModel, getDefaultSettings().defaultTactic),
  name: team.clubName,
  detail: team.season,
  clubId: team.clubId,
}));
const label = (team: Choice) => `${team.name} · ${team.detail}`;
const newCode = () => crypto.randomUUID();

function TeamIdentity({ team, side }: { team: Choice; side: string }) {
  return (
    <div className="match-identity">
      <span className="eyebrow">{side}</span>
      {team.clubId ? (
        <ClubBadge clubId={team.clubId} size="large" />
      ) : (
        <Shield className="own-team-mark" size={52} aria-hidden="true" />
      )}
      <h3>{team.name}</h3>
      <p>{team.detail}</p>
      <span className="match-strength-label">
        Matchstärke <strong>{formatStrength(team.strength)}</strong>
      </span>
    </div>
  );
}

export default function MatchPage() {
  const resultPanel = useRef<HTMLElement>(null);
  const { currentTeam, teamMatchesDraft, teamWarning } = useDraft();
  const choices: Choice[] = currentTeam
    ? [
        {
          ...savedMatchTeam(currentTeam, strengthModel),
          name: currentTeam.name,
          detail: 'Gespeicherte Elf',
          clubId: null,
        },
        ...catalog,
      ]
    : catalog;
  const [homeId, setHomeId] = useState(currentTeam?.id ?? 'real-madrid-2016-2017');
  const [awayId, setAwayId] = useState('barcelona-2010-2011');
  const [mode, setMode] = useState<'regular' | 'knockout'>('regular');
  const [neutral, setNeutral] = useState(true);
  const [seed, setSeed] = useState<string>(newCode);
  const [error, setError] = useState('');
  const [played, setPlayed] = useState<{
    result: MatchResult;
    home: Choice;
    away: Choice;
    neutral: boolean;
    mode: string;
  } | null>(null);
  const home = choices.find((team) => team.id === homeId)!;
  const away = choices.find((team) => team.id === awayId)!;
  const clear = () => {
    setPlayed(null);
    setError('');
  };
  function play(event: FormEvent) {
    event.preventDefault();
    try {
      const result = matchEngine.simulateMatch(home, away, {
        seed: seed.trim(),
        neutralVenue: neutral,
        mode,
      });
      setPlayed({ result, home: { ...home }, away: { ...away }, neutral, mode });
      setError('');
      requestAnimationFrame(() => {
        resultPanel.current?.focus({ preventScroll: true });
        if (window.innerWidth <= 1050)
          resultPanel.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
      });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Das Spiel konnte nicht simuliert werden.',
      );
    }
  }
  const result = played?.result;
  const finalScore = result?.afterExtraTime ?? result?.regularTime;
  const winner =
    played && result?.winnerParticipantId
      ? result.winnerParticipantId === played.home.id
        ? played.home
        : played.away
      : null;
  return (
    <>
      <PageHeading
        eyebrow="90 MINUTEN. ALLES OFFEN."
        title="Testspiel"
        description="Lass zwei Äras aufeinandertreffen – oder schick deine eigene Elf auf den Platz."
      />
      <div className="match-layout">
        <section className="panel match-setup" aria-labelledby="match-setup-title">
          <div className="section-heading">
            <h2 id="match-setup-title">Deine Begegnung</h2>
            <Swords size={21} aria-hidden="true" />
          </div>
          <form onSubmit={play} onChange={clear}>
            {(['home', 'away'] as const).map((side) => (
              <label className="match-field" key={side}>
                <span>{side === 'home' ? 'Heimteam' : 'Gastteam'}</span>
                <select
                  value={side === 'home' ? homeId : awayId}
                  onChange={(event) =>
                    side === 'home' ? setHomeId(event.target.value) : setAwayId(event.target.value)
                  }
                >
                  {choices.map((team) => (
                    <option
                      key={team.id}
                      value={team.id}
                      disabled={team.id === (side === 'home' ? awayId : homeId)}
                    >
                      {label(team)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label className="match-field">
              <span>Spielmodus</span>
              <select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
                <option value="regular">90 Minuten · Remis möglich</option>
                <option value="knockout">K.-o. · Verlängerung & Elfmeter</option>
              </select>
            </label>
            <label className="match-check">
              <input
                type="checkbox"
                checked={neutral}
                onChange={(event) => setNeutral(event.target.checked)}
              />
              Neutraler Platz
            </label>
            <p className="match-help">
              {neutral
                ? 'Beide Teams spielen ohne Heimvorteil.'
                : 'Das Heimteam erhält 1,5 Stärkepunkte Heimvorteil.'}
            </p>
            <label className="match-field">
              <span>Spielcode</span>
              <input
                value={seed}
                required
                maxLength={100}
                onChange={(event) => setSeed(event.target.value)}
                aria-describedby="code-help"
              />
            </label>
            <p className="match-help" id="code-help">
              Gleiche Teams, Einstellungen und gleicher Code ergeben dasselbe Ergebnis.
            </p>
            <div className="match-actions">
              <button
                type="button"
                className="button button--secondary"
                onClick={() => {
                  setSeed(newCode());
                  clear();
                }}
              >
                <Dices size={16} aria-hidden="true" />
                Neuer Code
              </button>
              <button type="submit" className="button button--primary">
                Anpfiff <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
            {error && (
              <p className="storage-warning" role="alert">
                {error}
              </p>
            )}
          </form>
          <div className="match-save-note">
            {currentTeam ? (
              <p>
                {teamMatchesDraft
                  ? 'Deine gespeicherte Elf ist spielbereit.'
                  : 'Für deine Elf gelten die zuletzt gespeicherten Werte. Änderungen im Draft zuerst speichern.'}
              </p>
            ) : (
              <p>
                Deine eigene Elf erscheint hier, sobald du sie im Team Builder vollständig
                gespeichert hast.
              </p>
            )}
            <Link className="text-link" to="/team-builder">
              Zum Team Builder <ArrowRight size={14} aria-hidden="true" />
            </Link>
            {teamWarning && <p role="alert">{teamWarning}</p>}
          </div>
        </section>
        <section
          ref={resultPanel}
          tabIndex={-1}
          className="panel match-stage"
          aria-labelledby="match-result-title"
        >
          <div className="match-stage-top">
            <p className="eyebrow">{played ? 'ABPFIFF' : 'DIE BÜHNE IST BEREIT'}</p>
            <span className="subtle-chip">
              {mode === 'regular' ? 'Testspiel · 90 Min.' : 'Testspiel · K.-o.'}
            </span>
          </div>
          <h2 className="sr-only" id="match-result-title">
            Spielergebnis
          </h2>
          <div className="match-scoreboard">
            <TeamIdentity team={played?.home ?? home} side="HEIM" />
            <div className="match-score" data-testid="match-score">
              {finalScore ? `${finalScore.home} : ${finalScore.away}` : 'VS'}
              <small>
                {result
                  ? result.afterExtraTime
                    ? 'NACH VERLÄNGERUNG'
                    : 'NACH 90 MINUTEN'
                  : 'BEREIT FÜR DEN ANPFIFF'}
              </small>
            </div>
            <TeamIdentity team={played?.away ?? away} side="GAST" />
          </div>
          <div className="match-announcement" role="status" aria-live="polite">
            {result ? (
              <>
                <strong>{winner ? `Sieger: ${winner.name}` : 'Unentschieden'}</strong>
                {result.afterExtraTime && (
                  <span>
                    Nach 90 Minuten {result.regularTime.home} : {result.regularTime.away}
                  </span>
                )}
                {result.penalties && (
                  <span>
                    Elfmeterschießen {result.penalties.home} : {result.penalties.away} · separat vom
                    Spielstand
                  </span>
                )}
              </>
            ) : (
              <>
                <strong>Zwei Teams. Eine Begegnung.</strong>
                <span>Wähle deine Teams und starte das Spiel.</span>
              </>
            )}
          </div>
          {result && played && (
            <div className="match-details">
              <dl className="match-xg">
                <div>
                  <dt>Erwartete Tore Heim</dt>
                  <dd>{formatStrength(result.expectedGoals.home)}</dd>
                </div>
                <div>
                  <dt>Erwartete Tore Gast</dt>
                  <dd>{formatStrength(result.expectedGoals.away)}</dd>
                </div>
              </dl>
              <p>
                Erwartete Tore beschreiben die Chancen vor dem Anpfiff. Auch das schwächere Team
                kann gewinnen.
              </p>
              {result.shootoutKicks.length > 0 && (
                <details className="match-penalties">
                  <summary>Elfmeterschießen ansehen</summary>
                  <ol>
                    {result.shootoutKicks.map((kick, index) => (
                      <li key={index}>
                        <span>
                          {kick.round}. Runde · {kick.side === 'home' ? 'Heim' : 'Gast'}
                        </span>
                        <strong>{kick.scored ? 'Treffer' : 'Vergeben'}</strong>
                      </li>
                    ))}
                  </ol>
                </details>
              )}
              <p className="match-code">
                Spielcode: <code>{result.seed}</code>
              </p>
            </div>
          )}
          <p className="match-stage-foot">
            Ein einzelnes Testspiel. Die Turniertabelle und Historie bleiben davon unberührt.
          </p>
        </section>
      </div>
      <CatalogNote />
    </>
  );
}
