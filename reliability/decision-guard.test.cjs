'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { candidate, makeBatch } = require('./fixtures.cjs');
const { selectBatch } = require('./decision-guard.cjs');
const { compare, runOriginal } = require('./run-comparison.cjs');
const status = (batch, id) => batch.find(x => x.json.id === id)?.json.batch_status;
const counts = batch => batch.reduce((out, x) => (out[x.json.batch_status] = (out[x.json.batch_status] || 0) + 1, out), {});
const fixture = makeBatch();

test('1: fixture has exactly 24 synthetic applicants', () => assert.equal(fixture.length, 24));
test('2: original export selects Mira despite HUMAN_REVIEW', () => assert.equal(status(runOriginal(fixture), 'MIRA-SYNTHETIC'), 'Shortlisted'));
test('3: original shortlist has two candidates', () => assert.equal(counts(runOriginal(fixture)).Shortlisted, 2));
test('4: improved selector sends Mira to human review', () => assert.equal(status(selectBatch(fixture), 'MIRA-SYNTHETIC'), 'Human-Review'));
test('5: improved selector never shortlists flagged candidate', () => {
  const selected = selectBatch(fixture).filter(x => x.json.batch_status === 'Shortlisted').map(x => x.json.id);
  assert.ok(!selected.includes('MIRA-SYNTHETIC'));
});
test('6: Nia fills next eligible slot', () => assert.equal(status(selectBatch(fixture), 'NIA-SYNTHETIC'), 'Shortlisted'));
test('7: Ada remains shortlisted', () => assert.equal(status(selectBatch(fixture), 'ADA-SYNTHETIC'), 'Shortlisted'));
test('8: improved shortlist retains two slots', () => assert.equal(counts(selectBatch(fixture)).Shortlisted, 2));
test('9: improved human review count is one', () => assert.equal(counts(selectBatch(fixture))['Human-Review'], 1));
test('10: improved archive count is twenty-one', () => assert.equal(counts(selectBatch(fixture))['Archived-Not-Selected'], 21));
test('11: explicit HUMAN_REVIEW routes to review without contradiction', () => {
  const items = makeBatch(); items[0] = candidate('MIRA-SYNTHETIC', 9.9, { recommendation: 'HUMAN_REVIEW' });
  assert.equal(status(selectBatch(items), 'MIRA-SYNTHETIC'), 'Human-Review');
});
test('12: contradiction alone routes to human review', () => {
  const items = makeBatch(); items[0] = candidate('MIRA-SYNTHETIC', 9.9, { contradiction: true });
  assert.equal(status(selectBatch(items), 'MIRA-SYNTHETIC'), 'Human-Review');
});
test('13: missing contradiction flag fails closed to review', () => {
  const items = makeBatch(); delete items[0].json.property_contradiction_flag;
  assert.equal(status(selectBatch(items), 'MIRA-SYNTHETIC'), 'Human-Review');
});
test('14: low-volume batch routes everyone to human review', () => {
  const results = selectBatch(makeBatch().slice(0, 9));
  assert.equal(results.length, 9);
  assert.ok(results.every(x => x.json.batch_status === 'Human-Review'));
});
test('15: deterministic comparison matches expected before/after', () => {
  const result = compare();
  assert.deepEqual(result.before.flagged_auto_shortlisted, ['MIRA-SYNTHETIC']);
  assert.deepEqual(result.after.flagged_auto_shortlisted, []);
  assert.equal(result.specific_cases.nia.after, 'Shortlisted');
});
