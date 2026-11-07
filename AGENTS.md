# Architecture rules
- Store assignment rubrics in the existing `assignments.rubric_criteria` JSON field; this avoids a separate unavailable rubric table for assignment workflows.
- Scale selected rubric points to the assignment maximum and preserve criterion feedback in the existing submission feedback field; this keeps grading usable without a new breakdown column.
- Track engagement only on loaded, institution-scoped student materials; unmount/visibility cleanup prevents cross-resource attribution.
- Start quiz monitoring only after explicit consent and a persisted attempt; browser signals are advisory, not an identity check or a secure exam lockdown.
- Keep assignment-grade and invoice notifications owned by existing database triggers; dispatch missing submission notices through an authenticated Edge handler with server-derived recipients and deterministic primary keys to avoid duplicates.- Detect timetable clashes (same tutor or stream, overlapping times) client-side in a pure helper; warn but allow saving so admins can resolve gradually.
