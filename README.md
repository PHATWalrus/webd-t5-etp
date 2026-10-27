# ALIBI.exe

A neobrutalist, five-round interrogation game for a college web development demo. Choose one of three authored case files (or let the detective assign one) and an innocent or guilty role, defend your story as evidence arrives, and reach one of three endings. Each case has five public clues and two private briefing variants per role. There are no accounts, timer, or multiplayer.

**Live:** https://alibi-exe.harshit-sinha2017.workers.dev

## Stack

Next.js 16.4.3 / React 19.3.1, TypeScript, Tailwind v4, Radix Dialog, Driver.js 1.10.2, and an adapted React Bits Animated List. The responsive UI uses bold borders, offset shadows, and yellow/blue/orange paper panels with static headings. Bun 1.4.4 with a lockfile. Cloudflare Workers through OpenNext 1.20.13, Wrangler 4.153.0, and D1. Jev `jev-1.13.0` uses native server-side fetch.

## Local setup

Use Node.js 22+ and Bun 1.4.4. If your global Bun is older, prefix commands with `bunx --package bun@1.4.4 bun`.

```sh
bun install --frozen-lockfile
cp .dev.vars.example .dev.vars
# Set a random local RATE_LIMIT_SALT in .dev.vars.
bun run db:migrate:local
bun run dev
```

Open http://localhost:3000. Local AI is disabled deliberately: you can create/resume cases and test error/draft recovery. Automated tests inject fixture evaluations and never contact Jev. Do not put the production key against an independent local quota database.

Test the actual Workers bundle:

```sh
bun run build:worker
bunx wrangler dev --port 3000
```

Keep `.dev.vars` APP_ORIGIN at `http://localhost:3000` and AI_ENABLED=false. `next dev` uses OpenNext's Cloudflare dev bindings and the same local D1 migration state. Use the hostname matching APP_ORIGIN; `127.0.0.1` is a different origin.

## Tests

```sh
bun run typecheck
bun run test
bun run build:worker
# Start the local Worker on port 3000, then in another terminal:
bunx playwright install chromium
bun run test:e2e
```

The Bun suite runs game rules, real SQLite-backed D1 SQL, quota boundaries/concurrency, ownership, validation, provider errors, and payload redaction. Final verification: **37 passing Bun tests**, **12 passing Playwright tests**, TypeScript, and the OpenNext Worker build. Layouts were checked from 375px to 1920px. The finished UI is deployed. The Playwright suite uses the real Worker for create/resume and disabled-AI recovery; full endings are browser API fixtures. Separately, four live five-round games verified Jev through the production quota gate. Set PLAYWRIGHT_BASE_URL to change the browser target, but the disabled-AI tests are intended for local use.

## Cloudflare configuration and deployment

`wrangler.jsonc` identifies the chosen **Phatty s Account**, the `alibi-exe` Worker, its D1 database and two coarse rate-limit bindings. The database migration is `migrations/0001_initial.sql`. It has been applied to the live database.

Before deploying to a different account, change account_id, create a D1 database with `bunx wrangler d1 create alibi-exe`, and replace database_id. Keep APP_ORIGIN equal to the exact HTTPS app origin.

```sh
bunx wrangler login
bun run db:migrate:remote
bunx wrangler secret put TYPESAFE_API_KEY
bunx wrangler secret put RATE_LIMIT_SALT
bun run cf:typegen
bun run deploy
```

Use a random 32-byte secret for RATE_LIMIT_SALT. Rotating it invalidates browser ownership hashes and changes IP quota identities, so preserve it during ordinary deploys. Never commit a secret or use a NEXT_PUBLIC variable for one. The React Bits license is only used locally by the registry CLI and is not needed by the Worker. Both registries use environment-based Authorization in components.json; add REACTBITS_LICENSE_KEY to ignored .env.local only when reinstalling components.

Preview deployments must keep AI_ENABLED=false unless they use the same production D1 quota database. Production AI_ENABLED=true activates the secret-backed integration. To disable paid provider traffic, set AI_ENABLED=false and redeploy. Never increase the hard quota by changing a preview database or adding a second provider path.

## API

| Route | Body | Result |
| --- | --- | --- |
| POST /api/games | role: innocent/guilty, optional caseId or random | Owned GameView, session cookie |
| GET /api/games/:id | — | Current owned GameView |
| POST /api/games/:id/turns | round: 1–5, statement: 5–600 trimmed Unicode code points | Saved GameView |

POSTs require the configured Origin and application/json. Bodies are capped at 8 KiB while reading. Game responses are private/no-store. The HttpOnly, SameSite=Strict ownership cookie is Secure in production; local HTTP uses a development exception. A game link alone does not grant access. IPs and owner tokens are HMAC-hashed before D1 storage. Only Cloudflare's edge-supplied CF-Connecting-IP is trusted in production; this app must remain hosted on Workers.

## Spending and abuse limits

| Scope | Limit |
| --- | --- |
| All live Jev calls, across this application | **1,000 attempts per IST calendar day** |
| Browser session | 6 attempts / rolling 60 seconds; 50 / IST day |
| IP | 60 attempts / rolling 60 seconds; 500 / IST day |
| Game | One evaluation in flight; five accepted rounds |
| New games | 10 / browser / IST day; 400 globally / IST day |
| Coarse Workers API guard | 120 requests / IP / minute |
| Coarse creation guard | 10 requests / IP / minute |

Every Jev call requires one atomic D1 INSERT…SELECT reservation with all hard limits. The result must report exactly one changed row. Failed, timed-out and malformed upstream responses remain charged; denied requests and accepted duplicates make no new call. There are no automatic retries or refunds. Quotas fail closed on database errors. The coarse Cloudflare bindings are approximate and do not enforce the hard daily cap.

Daily dates come from server time in Asia/Kolkata; rolling windows span midnight. 429s include a reason, Retry-After and retryAt. Drafts stay in sessionStorage until a statement is accepted. A token/version guarded 30-second lease prevents simultaneous turns and protects against late responses.

Games expire after seven days. New game requests prune expired games and attempts older than eight days. Production application logs contain provider status, duration, and numeric token usage; player statements, cookies and keys are never logged by application code.

## Game rules

A Choice selects accept (+0), probe (+1), challenge (+2), or confession (+2 and a final confession flag). Confidence below 0.65 becomes probe. Invalid answers never advance a round. Jev sees the public accusation, current question, revealed evidence and player statements; it receives no private role, briefing or unrevealed evidence. Detective dialogue and endings are authored.

Exactly five accepted rounds are required for every case. Scores 0–2 release the player, 3–5 leave suspicion, and 6–10 or an accepted confession yield caught. Both roles and all three cases use the same judging rules. Detective suspicion is a game score, not a probability of guilt.

The available cases are The Missing Fest Fund, The Exam Paper Leak, and The Missing Trophy. A game stores its case, rules version, and one of two briefing variants selected for the role. Add a new version rather than silently changing ongoing cases after release.

The play header includes an optional Driver.js walkthrough. It can be replayed or skipped, shows the briefing, suspicion meter, evidence, question, transcript, and response controls, and restores the original tab and focus when it closes. It does not mutate game state.

## Classroom demo

1. Open the live app and select an innocent or guilty role and a case, or choose “Surprise me.”
2. Read the private briefing. In the play header, optionally run the replayable Walkthrough before inviting the professor to defend the alibi.
3. Open the first evidence card, show its limitations, and submit a clear answer.
4. Refresh to show D1 recovery; inspect the transcript and newly revealed clue.
5. Finish five rounds and explain how the fixed scoring produces the ending.
6. Show the atomic reservation SQL and the 999→1,000 concurrency test as the spending safeguard.

## Limits

Browser/IP quotas are anonymous abuse controls; clearing cookies creates a new browser identity, while the IP and global caps remain. Campus Wi-Fi shares an IP allowance. Model judgments can be imperfect. Shared evidence artwork is an authored illustration, not actual footage. No accounts, leaderboards, voice, WebGL or admin panel are included.

See docs/IMPLEMENTATION.md for verification and deployment records.
