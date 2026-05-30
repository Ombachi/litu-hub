# Litu Hub load tests

Synthetic load tests for the most dangerous workload in the system: a real
exam ending, with thousands of students hitting **submit** at the same time.

## Prerequisites

- [k6](https://k6.io/docs/getting-started/installation/) installed locally or in CI
- A non-production Supabase project (DO NOT run against live institution data)
- A seed script that creates:
  - 1 quiz with ~20 questions
  - N test students enrolled in the course
  - JWTs for each student, written one per line to `tokens.txt`

## Run

```bash
export SUPABASE_URL="https://<ref>.supabase.co"
export SUPABASE_ANON_KEY="<publishable-anon-key>"
export QUIZ_ID="<uuid-of-test-quiz>"
export STUDENT_TOKENS_FILE="./tokens.txt"
export VUS=500

k6 run load-tests/exam-submission.js
```

## What to watch

While the test runs, in another terminal:

```bash
# Database health (admin only)
curl -s "$SUPABASE_URL/functions/v1/db-health"   # if exposed

# Or from the Lovable Cloud dashboard: Database → Health
```

Look for:

- `submit_latency_ms p(95) < 2000` ← threshold
- `submit_errors rate < 0.01`     ← threshold
- PgBouncer connection saturation
- Deadlocks / rolled-back transactions trending up
- WAL growth

## Iterating

Start at `VUS=100`, double each run until you hit a threshold or a DB
warning. Record the breaking point in `RESULTS.md`; that's your real
concurrency capacity for high-stakes exams.

## CI

Add a nightly GitHub Action that runs `VUS=200` against the staging
project and fails the job if thresholds are breached. Do **not** wire this
to production.
