import { getIntlLocale } from '../i18n/locale.ts';
import { t, useLanguage } from '../i18n/react.ts';
import { ratingCriteria, evaluateSeasonRating } from '../engine/ratings.ts';
import type { PlayerSeason } from '../types/database.ts';
import { ratingModel, sources } from '../app/catalog.ts';
const labels = {
  performance: 'Positionsleistung',
  influence: 'Einfluss',
  consistency: 'Konstanz',
  bigGames: 'Große Spiele',
  historical: 'Historischer Vergleich',
};
export function RatingExplanation({ player }: { player: PlayerSeason }) {
  useLanguage();
  const assessment = player.ratingAssessment;
  if (!assessment) return null;
  const result = evaluateSeasonRating(assessment, ratingModel.rubric);
  return (
    <details className="rating-explanation">
      <summary>{t('Bewertung erkl\u00E4ren')}</summary>
      <p>
        <strong>
          {player.rating} · {t(result.band)}
        </strong>
      </p>
      <p>{t(assessment.rationale)}</p>
      <p>{t(ratingModel.rubric.roles[player.position])}</p>
      <dl>
        {ratingCriteria.map((key) => (
          <div key={key}>
            <dt>
              {t(labels[key])} ({Math.round(ratingModel.rubric.weights[key] * 100)} %)
            </dt>
            <dd>{assessment.scores[key]}</dd>
          </div>
        ))}
      </dl>
      <p>
        {t('Gewichteter Wert: ')}
        {t(result.weighted.toLocaleString(getIntlLocale(), { maximumFractionDigits: 2 }))}
        {t(' \u00B7 Freigabegrenze: ')}
        {result.ceiling}
      </p>
      {result.rating < Math.round(result.weighted) && <p>{t(result.restrictions.join(' '))}</p>}
      <p>
        {t(
          assessment.confidence === 'reference'
            ? 'Einzelbewertung mit historischem Referenzvergleich.'
            : assessment.confidence === 'limited'
              ? 'Begrenzte Beleglage; vorläufige Einordnung.'
              : 'Redaktionelle Saisonbewertung.',
        )}
        {t(' ')}
        {t(
          'Teilnoten sind redaktionelle Urteile, keine objektiven Messwerte. Quellen liefern Saisonkontext.',
        )}
      </p>
      <ul>
        {assessment.sourceIds.map((id) => {
          const source = sources.find((s) => s.id === id);
          return source ? (
            <li key={id}>
              <a href={source.url} title={source.title} target="_blank" rel="noreferrer">
                {source.title.split('—')[0]}
              </a>
            </li>
          ) : null;
        })}
      </ul>
    </details>
  );
}
