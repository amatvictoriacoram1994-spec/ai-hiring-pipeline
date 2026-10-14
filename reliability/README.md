# Hiring decision reliability: offline experiment

## The real failure

The original Stage 2 n8n workflow ranks candidates by scores and ownership signals, without using the Stage 1 Contradiction Flag or AI Recommendation in its selection criteria. Stage 1 writes those fields to Notion. A high-scoring candidate marked for human review could consequently be automatically shortlisted.

## Reproduce (Node.js, no external APIs)

From the repository root, run:

    node reliability/run-comparison.cjs
    node --test reliability/decision-guard.test.cjs

The comparison executes the original JavaScript embedded in the published stage2-batch-selection.json using an offline mock of the n8n input. It evaluates 24 **synthetic** applicants. The original selection code is not rewritten or modified.

| Outcome | Original | Guarded |
|---|---:|---:|
| Shortlisted | 2 | 2 |
| Human-Review | 0 | 1 |
| Archived-Not-Selected | 22 | 21 |
| Flagged automatically shortlisted | 1 | 0 |

The flagged candidate MIRA-SYNTHETIC (9.9/10) changes from Shortlisted to Human-Review; NIA-SYNTHETIC takes the next eligible shortlist slot. **15 local regression tests passed.** The original low-volume rule (under 10 applicants means human review), 7.0 score floor, tie-breaking order, and rounded 10%-of-eligible-survivors quota are retained.

## What changed

The offline guard reads the safety fields expected from Notion: property_contradiction_flag and property_ai_recommendation. Only candidates with contradiction_flag strictly false and recommendation SHORTLIST are eligible for automatic selection. Every other candidate is routed to human review, including records where either safety field is missing. It does not auto-reject flagged candidates.

## Limitations

- This is an **offline test**, not a deployed n8n update or validated Notion integration. The original n8n workflow exports have not been modified.
- The 24 applicants are synthetic, not real applicants. Results do not establish production accuracy, fairness, money saved, or processing time improvements.
- Live Notion connector property names and types require verification before integrating the safeguard. Do not treat Stage 2 as production-fixed.
- Model scoring quality and the correctness of contradiction detection were outside this test's scope. It targets downstream decision logic only.
