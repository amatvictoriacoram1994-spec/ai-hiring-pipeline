# AI Hiring Pipeline

An end-to-end candidate screening system built in n8n, using the Claude API for scoring and contradiction detection. Takes a resume from the moment someone applies, all the way to a shortlist decision, with zero manual screening in between.

## What it does

- **Stage 1 (real-time scoring):** fires the instant a candidate applies, pulls their resume, scores it across six weighted dimensions, and flags contradictions between what a candidate claims and what their resume actually supports.
- **Stage 2 (batch selection):** run on demand once a full applicant pool exists for a role. Ranks scored candidates, applies a floor and quota, and routes each candidate to Shortlisted, Human-Review, or Archived-Not-Selected.

## Why two stages

Real-time scoring and batch selection are different problems with different triggers. Stage 1 is event-driven and only ever looks at one candidate. Stage 2 is decision-driven, needs the full pool in view, and only runs when a human chooses to run it. Keeping them separate means Stage 2's logic can change without ever touching the live, unattended scoring pipeline.

## Stage 1 — Real-Time Scoring

`stage1-realtime-scoring.json`

**Flow:** Webhook → Wait/If (validate submission) → fetch resume PDF → extract text → Claude API call → validate JSON response → write to Notion.

**Scoring:** Claude scores each candidate across six weighted dimensions (Technical Fit, Experience Relevance, Company-Stage Fit, Impact Evidence, Communication Quality, Growth Signal), with weights adjusted by role type. It also cross-checks the candidate's stated years of experience and name against what the resume content actually supports, flagging contradictions rather than taking self-reported claims at face value.

**Bugs found and fixed during development:**
- *MBA-years miscount:* the model was initially counting full-time education (e.g. an MBA) as work experience, inflating some candidates' real experience by several years. Fixed by explicitly instructing the model to exclude full-time education from the experience calculation.
- *Stale-date reference:* experience-duration math was sometimes anchored to an outdated internal sense of "today." Fixed by injecting the actual current date into the prompt at execution time.

This stage runs unattended in production. It's published, not sitting on a test webhook, so every real application gets scored automatically.

## Stage 2 — Batch Selection

`stage2-batch-selection.json`

**Flow:** Manual Trigger → set which job to process → pull all scored candidates for that job → rank & select → loop and update Notion.

**Selection logic (in `Rank & Select Batch`):**
- Only candidates scoring **7.0 or above** ("survivors") are eligible for shortlisting.
- The shortlist quota is **10% of survivors**, not 10% of total applicants — a flood of weak applicants can't dilute the bar for strong ones.
- If the pool doesn't have enough strong candidates, the quota isn't padded to hit a round number. An empty shortlist is treated as a more honest outcome than a forced one.
- **Under 10 total applicants** for a role skips the floor/quota math entirely and routes everyone to Human-Review — automated ranking doesn't mean much on that small a sample.
- Job IDs keep roles isolated from each other; a Backend batch run never touches Frontend candidates, and vice versa.

## What this is (and isn't)

This is **AI-augmented workflow automation with embedded LLM reasoning** — a fixed, deterministic pipeline where the model reasons intelligently at two specific points (scoring and contradiction detection), not an autonomous agent deciding its own sequence of actions. That was a deliberate choice: for something that touches hiring decisions, every step needed to stay predictable, auditable, and reproducible.

## Known limitations

- No job registry yet to prevent accidentally double-processing the same batch.
- No duplicate-application detection across email/job ID — the same person applying twice currently creates two separate rows.
- No check that the resume-fetch step actually returned real content before scoring runs. A broken or private file link could currently fail silently and produce a garbage score with no warning. This is the most important gap and the next thing to fix.

## Setup notes

These workflow files are sanitized for public sharing — API keys, credential IDs, webhook paths, and the Notion database ID have all been replaced with placeholders. To run this yourself:

1. Import both JSON files into n8n.
2. Create a Notion integration and connect it as a credential in both workflows.
3. Create an Anthropic API key and add it as a **Header Auth** credential (header name `x-api-key`) on the Claude API call in Stage 1 — don't paste it directly into the node.
4. Point the Webhook node at your own application form, and set your own Notion database ID.

## Stack

n8n · Claude API (Sonnet) · Notion (as the candidate database) · Google Drive (resume storage) · Google Forms (application intake)
