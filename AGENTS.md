# VEOR Agent Charter

Read `CURSOR_HANDOFF.md` first.

Build toward a verifiable execution boundary, not an AI safety oracle.

Rules:
- model output can tighten authority, never grant it;
- tests precede security claims;
- no shell interpolation in execution paths;
- no raw secrets in ledgers;
- unknown effects fail closed;
- sandbox backend identity must be truthful;
- preserve transport/kernel/sandbox separation;
- two failed identical approaches require a level/scope audit before a third attempt.

Run `npm run check` before claiming completion.
