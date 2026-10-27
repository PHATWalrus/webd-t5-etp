# ALIBI.exe submission copy

## Problem statement

ALIBI.exe is an interactive, replayable interrogation game built around a product challenge: how can a web experience make a player defend a story over time while new evidence tests consistency? Instead of a fixed sequence of choices, each session combines one of three authored scenarios with an innocent or guilty role, then asks for five free-text responses. The detective evaluates each round against the current question, revealed evidence, and earlier statements, while authored rules turn the result into one of three verdicts. Players can refresh and resume saved progress, inspect their transcript and evidence, and optionally use a replayable Driver tour to understand the interface before continuing. The design keeps the core interaction legible for a demo while showing how state, model evaluation, and deterministic game rules can work together.

## Technologies used

The app uses Next.js with React, TypeScript, Tailwind CSS v4, Radix Dialog, Driver.js, and an adapted React Bits Animated List. Bun manages installation and scripts. It deploys to Cloudflare Workers through OpenNext, with Cloudflare D1 storing game state and quota reservations. Server routes use origin checks, an ownership cookie, bounded input, and atomic reservations. Jev's Choice API supplies server-side round evaluations; authored case data, scoring, evidence, and verdict rules remain in the application. The client preserves drafts in sessionStorage and resumes saved games from D1.

## Submission links

- Source code: https://github.com/PHATWalrus/webd-t5-etp/tree/feat/alibi-exe
- Live app: https://alibi-exe.harshit-sinha2017.workers.dev
- Demo video: https://alibi-exe.harshit-sinha2017.workers.dev/demo/alibi-exe-demo.mp4

The video is a captioned workflow demo showing scenario and role selection, the Driver tour, evidence review, five real Jev rounds, draft/refresh/resume recovery, and the final verdict.
