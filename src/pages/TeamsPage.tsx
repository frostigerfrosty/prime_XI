import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { clubs, targetYears } from '../app/catalog.ts';
import { CatalogNote, PageHeading, TeamCard } from '../components/ui.tsx';
import { searchPrimeTeams } from '../data/index.ts';

export default function TeamsPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const year = params.get('year') ?? '';
  const clubId = params.get('club') ?? '';
  const filtered = searchPrimeTeams({
    query,
    ...(year ? { year: Number(year) } : {}),
    ...(clubId ? { clubId } : {}),
  });
  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }
  return (
    <>
      <PageHeading
        eyebrow="DER PRIME-KATALOG"
        title="Die Besten ihrer Zeit."
        description="60 Saisonmannschaften. 20 Jahrgänge. Entdecke die Teams hinter deiner zukünftigen Traumelf."
      />
      <CatalogNote />
      <section className="catalog-filters panel" aria-label="Teamfilter">
        <label className="search-input">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Teams oder Trainer suchen</span>
          <input
            type="search"
            value={query}
            onChange={(event) => update('q', event.target.value)}
            placeholder="Team, Saison oder Trainer suchen …"
          />
        </label>
        <label className="filter-select">
          <span className="sr-only">Jahrgang</span>
          <select value={year} onChange={(event) => update('year', event.target.value)}>
            <option value="">Alle Jahrgänge</option>
            {targetYears.toReversed().map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-select">
          <span className="sr-only">Verein</span>
          <select value={clubId} onChange={(event) => update('club', event.target.value)}>
            <option value="">Alle Vereine</option>
            {clubs
              .toSorted((a, b) => a.name.localeCompare(b.name, 'de'))
              .map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
          </select>
        </label>
      </section>
      <div className="catalog-results">
        <p role="status">
          <strong>{filtered.length}</strong> {filtered.length === 1 ? 'Prime-Team' : 'Prime-Teams'}{' '}
          <span>im Katalog</span>
        </p>
        {(query || year || clubId) && (
          <button className="text-link" onClick={() => setParams({})}>
            <X size={15} aria-hidden="true" /> Filter zurücksetzen
          </button>
        )}
      </div>
      {filtered.length ? (
        <div className="team-grid">
          {filtered.map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
        </div>
      ) : (
        <section className="panel no-results">
          <SlidersHorizontal size={30} aria-hidden="true" />
          <h2>Kein Team gefunden.</h2>
          <p>Versuche einen anderen Namen oder setze deine Filter zurück.</p>
          <button className="button button--secondary" onClick={() => setParams({})}>
            Alle Teams anzeigen
          </button>
        </section>
      )}
    </>
  );
}
