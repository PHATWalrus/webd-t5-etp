# ALIBI.exe implementation ledger

Approved specification: the implementation plan supplied in this chat, 27 October 2026.

## Requirements

Three authored case files (The Missing Fest Fund, The Exam Paper Leak, and The Missing Trophy), both roles, five rounds, two private briefing variants per role and case, and three endings. Jev sees only public revealed facts and statements. Next.js/OpenNext on Workers, Bun, D1, Radix Dialog, Driver.js, and the adapted React Bits Animated List. Cipher Reveal source is retained locally; headings are static under the current motion requirements. The responsive UI uses the current neobrutalist paper-panel treatment. The play header exposes an optional, replayable Driver.js walkthrough for the briefing, suspicion meter, evidence, question, transcript, and response controls; it does not mutate game state. No accounts or multiplayer. Strict 1,000 Jev attempts per IST day; every outbound attempt is reserved atomically in D1, including failures. Session 6/minute and 50/day; IP 60/minute and 500/day. Game creation 10/session/day and 400/global/day. Coarse API 120/IP/minute; starts 10/IP/minute. Seven-day games and eight-day attempt retention. No silent AI fallback.

## Shared interfaces

- UI, rules, API and database share `src/lib/game/types.ts`.
- Domain owns authored case, rules and public view serialization.
- Database owns migrations, locks, conditional game creation and AI admission.
- Server owns HTTP validation, ownership, single Jev fetch and route orchestration.
- UI owns entry, interrogation, evidence, verdict and responsive styling.

## Progress

- The three-case model is implemented. Each case has five progressively revealed public clues, authored replies and role-specific epilogues, and two briefing variants per role. Case and briefing variant are persisted with the game.
- The current UI is the responsive neobrutalist surface in `src/app/globals.css`, with case selection on the entry screen, a case-specific play view, evidence dialogs, mobile interrogation/evidence tabs, and the optional Driver.js walkthrough.
- Credentials: existing secrets are uploaded for the configured environment; values are never printed or recorded here. React Bits licensing was previously accepted.
- A `bun.lock` lockfile is present. No commit or push has been made for this documentation update.
- Live URL: `https://alibi-exe.harshit-sinha2017.workers.dev`, configured for the existing **Phatty s Account**. The live D1 migration is recorded as applied. The production key is not copied into local or preview environments.
- Deployment snapshot: version `14b4d332-a784-4fdb-9a09-59207ac6b1b0` was deployed before the final UI pass. It completed **20 live Jev calls** through the real quota path across four complete five-round games: innocent fest-fund with five consistent accepts (score 0, released); guilty exam-leak cover story with five accepts (score 0, released); innocent missing-trophy with five evasive/probe answers (score 5, under suspicion, including a prompt-injection instruction being probed); and guilty fest-fund with contradictions and confessions (score 9, caught). The first-path quoted admission and denial were accepted without a confession.
- Provider verification: the default wrapper calls `globalThis.fetch` with its receiver preserved. Redirect following is disabled and 3xx responses are rejected. This fixed the native server-side fetch failure seen before live verification. Repeating an accepted statement after completion returned the same verdict and left its attempt count at five.
- Final UI deployment: version `34ab42a6-2d91-4732-bac8-78966970f395`, including the neobrutalist layout and Driver.js walkthrough. Worker upload was approximately 1,071 KiB gzip; startup was 20 ms.
- Final verification: **37 Bun tests across four files**, **12 Playwright tests against the actual Workers bundle**, TypeScript, and the OpenNext Worker build passed. Home layouts were checked at 375, 768, 1024, 1440, and 1920 pixels, with no out-of-viewport elements. Browser checks cover skip/replay, next/back, Done/Escape, focus restoration, mobile evidence switching, reduced motion, scenarios, and draft recovery. The live AI path is verified for the scenarios above; broader live coverage remains intentionally limited.
- Runtime observation: deployed requests used about 24 ms CPU for a turn and 101 ms for game creation; a cold SSR request may take about 440 ms. No free-plan CPU allowance or status was confirmed, so this ledger makes no free-tier compatibility claim.

## Rulings

- Work in a feature branch in the existing blank checkout; preserve unrelated files.
- The current neobrutalist UI is the source of truth for the entry and play surfaces; the walkthrough is optional and secondary to the game flow.
- Tests may use fixture evaluations; public production never substitutes fabricated judgments for Jev.
