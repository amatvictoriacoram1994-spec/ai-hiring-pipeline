'use strict';

// Entirely fictional applicants. No resumes, accounts, or real person records.
function candidate(id, score, { contradiction = false, recommendation = 'SHORTLIST', technical = score, signal = 'Strong' } = {}) {
  return { json: {
    id, property_name: id, property_overall_score: score,
    property_technical_score: technical, property_ownership_signal: signal,
    property_contradiction_flag: contradiction,
    property_ai_recommendation: recommendation,
  } };
}

function makeBatch() {
  const batch = [
    candidate('MIRA-SYNTHETIC', 9.9, { contradiction: true, recommendation: 'HUMAN_REVIEW' }),
    candidate('ADA-SYNTHETIC', 9.8),
    candidate('NIA-SYNTHETIC', 9.7),
  ];
  for (let i = 0; i < 17; i++) {
    batch.push(candidate('ELIGIBLE-' + String(i + 1).padStart(2, '0'), Number((9.5 - i * 0.11).toFixed(2))));
  }
  for (let i = 0; i < 4; i++) batch.push(candidate('BELOW-FLOOR-' + (i + 1), 6.8 - i * 0.5));
  return batch;
}
module.exports = { candidate, makeBatch };
