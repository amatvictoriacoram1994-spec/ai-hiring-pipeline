'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { makeBatch } = require('./fixtures.cjs');
const { selectBatch } = require('./decision-guard.cjs');

// Execute the exact ORIGINAL exported n8n code, with a mock $input.
function runOriginal(items, workflowPath = path.join(__dirname, '..', 'stage2-batch-selection.json')) {
  const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
  const node = workflow.nodes.find(n => n.name === 'Rank & Select Batch');
  if (!node?.parameters?.jsCode) throw new Error('Original Rank & Select Batch code not found');
  const wrapped = '(function() {\n' + node.parameters.jsCode + '\n})()';
  const output = vm.runInNewContext(wrapped, { $input: { all: () => items } }, { timeout: 3000 });
  return JSON.parse(JSON.stringify(output));
}

function tally(results) {
  const counts = { Shortlisted: 0, 'Human-Review': 0, 'Archived-Not-Selected': 0 };
  for (const { json } of results) counts[json.batch_status]++;
  return counts;
}
function compare(items = makeBatch(), workflowPath) {
  const before = runOriginal(items, workflowPath);
  const after = selectBatch(items);
  const flaggedIds = new Set(items.filter(x => x.json.property_contradiction_flag === true || x.json.property_ai_recommendation === 'HUMAN_REVIEW').map(x => x.json.id));
  const flaggedShortlists = results => results.filter(x => x.json.batch_status === 'Shortlisted' && flaggedIds.has(x.json.id)).map(x => x.json.id);
  const decision = (results, id) => results.find(x => x.json.id === id)?.json.batch_status;
  return {
    dataset: '24 synthetic applicants, offline deterministic test',
    input_count: items.length,
    before: { ...tally(before), flagged_auto_shortlisted: flaggedShortlists(before) },
    after: { ...tally(after), flagged_auto_shortlisted: flaggedShortlists(after) },
    specific_cases: {
      mira: { before: decision(before, 'MIRA-SYNTHETIC'), after: decision(after, 'MIRA-SYNTHETIC') },
      nia: { before: decision(before, 'NIA-SYNTHETIC'), after: decision(after, 'NIA-SYNTHETIC') },
    },
  };
}
if (require.main === module) console.log(JSON.stringify(compare(), null, 2));
module.exports = { runOriginal, compare };
