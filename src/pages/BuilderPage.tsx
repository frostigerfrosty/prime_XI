import { useState } from 'react';
import {
  ArrowUpRight,
  Check,
  CircleDashed,
  Dices,
  Info,
  LockKeyhole,
  Shield,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formations } from '../app/catalog.ts';
import { Pitch } from '../components/Pitch.tsx';
import { PageHeading } from '../components/ui.tsx';
import { getGameRules } from '../data/index.ts';

export default function BuilderPage() {
  const [formationId, setFormationId] = useState(() => getGameRules().builder.defaultFormation);
  const formation = formations.find((candidate) => candidate.id === formationId)!;
  return (
    <>
      <PageHeading
        eyebrow="DEINE IDEEN. DEINE AUFSTELLUNG."
        title="Team Builder"
        description="Hier entsteht deine Elf aus den besten Prime-Mannschaften."
      />
      <div className="builder-notice">
        <Info size={18} aria-hidden="true" />
        <p>
          <strong>Das Spielfeld steht bereit.</strong> Du kannst bereits die Formationen ansehen.
          Teams ziehen und Spieler wählen folgt in der nächsten Etappe.
        </p>
      </div>
      <div className="builder-grid">
        <section className="panel lineup-panel">
          <div className="section-heading">
            <h2>Deine Aufstellung</h2>
            <label className="formation-select">
              <span>Formation</span>
              <select
                value={formationId}
                onChange={(event) => {
                  const selected = formations.find((item) => item.id === event.target.value);
                  if (selected) setFormationId(selected.id);
                }}
              >
                {formations.map((item) => (
                  <option key={item.id}>{item.id}</option>
                ))}
              </select>
            </label>
          </div>
          <Pitch formation={formation} />
          <div className="lineup-footer">
            <span>
              <UsersRound size={16} aria-hidden="true" />
              <strong>0 / 11</strong> Spieler
            </span>
            <span>
              <UserRound size={16} aria-hidden="true" />
              <strong>0 / 1</strong> Coach
            </span>
            <span>
              <Shield size={16} aria-hidden="true" /> Stärke <strong>–</strong>
            </span>
          </div>
        </section>
        <div className="builder-side">
          <section className="panel draft-panel">
            <div className="section-heading">
              <h2>Dein Draft</h2>
              <span className="subtle-chip">0 / 12 Teams</span>
            </div>
            <div className="draft-icon">
              <Dices size={34} strokeWidth={1.2} aria-hidden="true" />
            </div>
            <h3>
              Zwölf Teams.
              <br />
              Unzählige Möglichkeiten.
            </h3>
            <p>Deine zukünftige Auswahl beginnt mit zwölf unterschiedlichen Prime-Teams.</p>
            <button className="button button--primary" disabled>
              <Dices size={17} aria-hidden="true" /> 12 Teams ziehen
            </button>
            <small>In der nächsten Etappe verfügbar</small>
          </section>
          <section className="panel checklist-panel">
            <p className="eyebrow">VOR DEM ANPFIFF</p>
            <h2>Was deiner Elf noch fehlt</h2>
            <ul>
              <li>
                <CircleDashed size={17} aria-hidden="true" /> 11 Spieler auf gültigen Positionen
              </li>
              <li>
                <CircleDashed size={17} aria-hidden="true" /> Ein Coach aus deinen Prime-Teams
              </li>
              <li>
                <Check size={17} className="accent-text" aria-hidden="true" /> Eine Formation für
                deinen Plan
              </li>
            </ul>
            <button className="button button--locked" disabled>
              <LockKeyhole size={15} aria-hidden="true" /> Team speichern & Turnier starten
            </button>
            <p>Erst mit einer vollständigen Elf und einem Coach geht es ins Turnier.</p>
          </section>
        </div>
      </div>
      <section className="panel draft-empty-strip">
        <div>
          <p className="eyebrow">GEZOGENE PRIME-TEAMS</p>
          <h2>Hier beginnt später deine Auswahl.</h2>
          <p>Bis dahin kannst du alle 60 Saisonmannschaften im Katalog entdecken.</p>
        </div>
        <Link className="button button--secondary" to="/teams">
          Prime-Teams ansehen <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </section>
    </>
  );
}
