# E2E Tests (Playwright)

## Setup

```bash
npm install -D @playwright/test
npx playwright install
```

## Running

```bash
npx playwright test
npx playwright test --ui  # Interactive mode
```

## Test Coverage

- `auth.spec.ts` — Login, signup, forgot password, logout
- `enrollment.spec.ts` — Course browsing, enrollment request
- `quiz.spec.ts` — Quiz taking, timer, submission
- `assignment.spec.ts` — Assignment viewing, submission, file upload
- `grading.spec.ts` — Tutor grading queue, score entry, AI feedback
