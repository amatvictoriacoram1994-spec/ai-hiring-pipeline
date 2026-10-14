'use strict';

// Offline counterpart of the Rank & Select Batch node. No external services or writes.
const FLOOR = 7.0;

function ownershipRank(value) {
  return value === 'Strong' ? 3 : value === 'Moderate' ? 2 : value === 'Weak' ? 1 : 0;
}

function selectBatch(items) {
  const candidates = items.map(({ json }) => ({
    id: json.id,
    name: json.property_name,
    overall_score: json.property_overall_score,
    technical_score: json.property_technical_score,
    ownership_rank: ownershipRank(json.property_ownership_signal),
    contradiction_flag: json.property_contradiction_flag,
    ai_recommendation: json.property_ai_recommendation,
  }));

  // Preserve the original policy: fewer than 10 applicants => all human review.
  if (candidates.length < 10) {
    return candidates.map(c => ({ json: {
      id: c.id, name: c.name, batch_status: 'Human-Review',
      percentile_rank: null,
      reason: 'Low volume batch (<10 total applicants), routed to Human Review per policy',
    } }));
  }

  // Guard applies before ranking and quota; missing safety fields fail closed.
  const needsHumanReview = c =>
    c.contradiction_flag !== false ||
    c.ai_recommendation !== 'SHORTLIST';

  const review = candidates.filter(needsHumanReview);
  const eligible = candidates.filter(c => !needsHumanReview(c));
  const survivors = eligible.filter(c => c.overall_score >= FLOOR);
  const nonSurvivors = eligible.filter(c => c.overall_score < FLOOR);

  survivors.sort((a, b) =>
    (b.overall_score - a.overall_score) ||
    (b.technical_score - a.technical_score) ||
    (b.ownership_rank - a.ownership_rank)
  );

  // Original 10%-of-survivors rule, after excluding human-review candidates.
  const quota = Math.round(survivors.length * 0.10);
  const results = [];
  const tieKey = c => c.overall_score + '|' + c.technical_score + '|' + c.ownership_rank;
  let groupStraddles = false;
  let cutoffKey = null;
  if (quota > 0 && survivors.length > 0) {
    cutoffKey = tieKey(survivors[quota - 1]);
    const tieIndices = survivors.flatMap((c, i) => tieKey(c) === cutoffKey ? [i] : []);
    groupStraddles = tieIndices.some(i => i < quota) && tieIndices.some(i => i >= quota);
  }

  survivors.forEach((c, idx) => {
    const status = quota > 0 && groupStraddles && tieKey(c) === cutoffKey
      ? 'Human-Review'
      : idx < quota ? 'Shortlisted' : 'Archived-Not-Selected';
    results.push({ id: c.id, name: c.name, batch_status: status, percentile_rank: idx + 1 });
  });
  nonSurvivors.forEach(c => results.push({
    id: c.id, name: c.name, batch_status: 'Archived-Not-Selected', percentile_rank: null,
  }));
  review.forEach(c => results.push({
    id: c.id, name: c.name, batch_status: 'Human-Review', percentile_rank: null,
    reason: 'Contradiction flagged, AI requested human review, or safety field unavailable',
  }));
  return results.map(json => ({ json }));
}
module.exports = { selectBatch };
