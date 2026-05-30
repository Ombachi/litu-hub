// Synthetic load test for the exam-submission path.
// Run with: k6 run --vus 200 --duration 2m load-tests/exam-submission.js
//
// Required env:
//   SUPABASE_URL         e.g. https://<ref>.supabase.co
//   SUPABASE_ANON_KEY    publishable anon key
//   QUIZ_ID              quiz UUID to attack
//   STUDENT_TOKENS_FILE  newline-separated list of student JWTs (export
//                        from a test seed). Each VU picks one round-robin.
//
// Stages model a real exam: students log in over ~30s, take the quiz for
// the time limit, then everyone hits submit in a thundering herd. Watch:
//   - submit_quiz_attempt p95 latency
//   - error rate on /rpc/submit_quiz_attempt
//   - database deadlocks / pgbouncer saturation in db_health
//
// Fail thresholds reject the run if p95 > 2s or errors > 1%.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const submitLatency = new Trend('submit_latency_ms', true);
const submitErrors = new Rate('submit_errors');

const tokens = new SharedArray('tokens', () => {
  const raw = open(__ENV.STUDENT_TOKENS_FILE || './tokens.txt');
  return raw.split('\n').map(s => s.trim()).filter(Boolean);
});

export const options = {
  scenarios: {
    exam: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: Number(__ENV.VUS || 200) }, // ramp in
        { duration: '60s', target: Number(__ENV.VUS || 200) }, // sustained quiz-taking
        { duration: '10s', target: Number(__ENV.VUS || 200) }, // submission stampede
        { duration: '15s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    submit_latency_ms: ['p(95)<2000'],
    submit_errors: ['rate<0.01'],
    http_req_failed: ['rate<0.02'],
  },
};

const SUPA = __ENV.SUPABASE_URL;
const ANON = __ENV.SUPABASE_ANON_KEY;
const QUIZ_ID = __ENV.QUIZ_ID;
if (!SUPA || !ANON || !QUIZ_ID) throw new Error('SUPABASE_URL, SUPABASE_ANON_KEY and QUIZ_ID must be set');

function headers(jwt) {
  return {
    'Content-Type': 'application/json',
    apikey: ANON,
    Authorization: `Bearer ${jwt}`,
  };
}

export default function () {
  const jwt = tokens[(__VU - 1) % tokens.length];
  if (!jwt) return;

  // 1. Fetch questions (RPC strips correct answers for students)
  const qRes = http.post(
    `${SUPA}/rest/v1/rpc/get_quiz_questions_for_student`,
    JSON.stringify({ _quiz_id: QUIZ_ID }),
    { headers: headers(jwt), tags: { name: 'load_questions' } },
  );
  check(qRes, { 'load questions 200': r => r.status === 200 });
  const questions = qRes.json() || [];
  if (!Array.isArray(questions) || questions.length === 0) return;

  // 2. Start attempt
  const startRes = http.post(
    `${SUPA}/rest/v1/quiz_attempts`,
    JSON.stringify({ quiz_id: QUIZ_ID }),
    { headers: { ...headers(jwt), Prefer: 'return=representation' }, tags: { name: 'start_attempt' } },
  );
  check(startRes, { 'start attempt 201': r => r.status === 201 });
  const attempt = (startRes.json() || [])[0];
  if (!attempt?.id) return;

  // 3. "Take" the quiz — simulate think time so submits cluster at the end
  sleep(randomIntBetween(20, 50));

  // 4. Submit all responses in one RPC call (server-side scoring)
  const responses = questions.map(q => ({
    question_id: q.id,
    response: Array.isArray(q.options) && q.options[0] ? q.options[0] : 'true',
  }));
  const t0 = Date.now();
  const submitRes = http.post(
    `${SUPA}/rest/v1/rpc/submit_quiz_attempt`,
    JSON.stringify({ _attempt_id: attempt.id, _responses: responses }),
    { headers: headers(jwt), tags: { name: 'submit_attempt' } },
  );
  submitLatency.add(Date.now() - t0);
  const ok = submitRes.status === 200;
  submitErrors.add(!ok);
  check(submitRes, { 'submit 200': () => ok });
}
