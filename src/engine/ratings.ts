import type { Position } from '../types/database.ts';

export const ratingCriteria = [
  'performance',
  'influence',
  'consistency',
  'bigGames',
  'historical',
] as const;
export type RatingCriterion = (typeof ratingCriteria)[number];
export interface SeasonRatingAssessment {
  profileId: string;
  scores: Record<RatingCriterion, number>;
  rationale: string;
  confidence: 'limited' | 'editorial' | 'reference';
  sourceIds: string[];
  /** A separate editorial decision; a high weighted score never grants this automatically. */
  historicalException: { justification: string; sourceIds: string[] } | null;
}
export interface RatingRubric {
  version: string;
  scope: 'club-season';
  weights: Record<RatingCriterion, number>;
  bands: { minimum: number; label: string }[];
  roles: Record<Position, string>;
  criterionDescriptions: Record<RatingCriterion, string>;
  gates: {
    limitedEvidenceCap: number;
    worldClassMinimumHistory: number;
    exceptionalMinimumHistory: number;
    historicMinimumHistory: number;
    historicMinimumPerformance: number;
    historicMinimumInfluence: number;
    historicMinimumConsistency: number;
  };
}

/** Editorial judgments are explicit inputs; this function only enforces their common scale. */
export function evaluateSeasonRating(assessment: SeasonRatingAssessment, rubric: RatingRubric) {
  if (
    rubric.scope !== 'club-season' ||
    Math.abs(ratingCriteria.reduce((sum, key) => sum + rubric.weights[key], 0) - 1) > 1e-10 ||
    ratingCriteria.some((key) => !Number.isFinite(rubric.weights[key]) || rubric.weights[key] < 0)
  )
    throw new Error('Ungültige Gewichtung der Saisonbewertung.');
  if (
    !assessment ||
    !assessment.profileId ||
    !assessment.rationale?.trim() ||
    !['limited', 'editorial', 'reference'].includes(assessment.confidence) ||
    !Array.isArray(assessment.sourceIds) ||
    !assessment.sourceIds.length ||
    ratingCriteria.some(
      (key) =>
        !Number.isInteger(assessment.scores?.[key]) ||
        assessment.scores[key] < 0 ||
        assessment.scores[key] > 99,
    )
  )
    throw new Error('Unvollständige Saisonbewertung.');
  const weighted =
    Math.round(
      ratingCriteria.reduce((sum, key) => sum + assessment.scores[key] * rubric.weights[key], 0) *
        100,
    ) / 100;
  let ceiling = 99;
  const restrictions: string[] = [];
  if (assessment.confidence === 'limited') {
    ceiling = rubric.gates.limitedEvidenceCap;
    restrictions.push('Begrenzte Beleglage: vorläufige Einordnung, keine Weltklasse-Freigabe.');
  }
  if (assessment.scores.historical < rubric.gates.worldClassMinimumHistory) {
    ceiling = Math.min(ceiling, 89);
    restrictions.push(
      '90+ erfordert eine klare Einordnung gegenüber Weltklasse-Referenzsaisons der Rolle.',
    );
  }
  if (
    assessment.scores.historical < rubric.gates.exceptionalMinimumHistory ||
    assessment.confidence !== 'reference'
  ) {
    ceiling = Math.min(ceiling, 94);
    restrictions.push(
      '95+ benötigt eine begründete Einzelprüfung anhand historischer Positionsreferenzen.',
    );
  }
  const exception = assessment.historicalException;
  if (
    assessment.confidence !== 'reference' ||
    !exception?.justification.trim() ||
    !exception.sourceIds.length ||
    !exception.sourceIds.every((id) => assessment.sourceIds.includes(id)) ||
    assessment.scores.historical < rubric.gates.historicMinimumHistory ||
    assessment.scores.performance < rubric.gates.historicMinimumPerformance ||
    assessment.scores.influence < rubric.gates.historicMinimumInfluence ||
    assessment.scores.consistency < rubric.gates.historicMinimumConsistency
  ) {
    ceiling = Math.min(ceiling, 97);
    restrictions.push('98/99 benötigen eine gesondert belegte historische Ausnahmeentscheidung.');
  }
  const rating = Math.min(Math.round(weighted), ceiling);
  return {
    weighted,
    ceiling,
    rating,
    restrictions,
    band:
      rubric.bands.find((band) => rating >= band.minimum)?.label ??
      'Entwicklung / begrenzter Saisonbeitrag',
  };
}
