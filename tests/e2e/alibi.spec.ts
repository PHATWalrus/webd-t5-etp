import { expect, test, type Page } from "@playwright/test";
import { applyTurn, initialState, toGameView } from "../../src/lib/game/rules";
import type { Evaluation, GameState, GameView, Role, Verdict } from "../../src/lib/game/types";

import { CASE_BRIEFINGS } from "../../src/lib/game/briefings";
import { CASE_TITLE } from "../../src/lib/game/case";
const evaluation = (reaction: Evaluation["reaction"]): Evaluation => ({ reaction, confidence: 0.99 });
const evaluations = (...reactions: Evaluation["reaction"][]): Evaluation[] => reactions.map(evaluation);
const fixtureEvaluations: Record<Verdict, Evaluation[]> = {
  released: evaluations("accept", "accept", "accept", "accept", "accept"),
  under_suspicion: evaluations("probe", "probe", "probe", "accept", "accept"),
  caught: [evaluation("confession"), ...evaluations("accept", "accept", "accept", "accept")],
};

function fixtureView(id: string, role: Role, state: GameState, processing = false): GameView {
  return toGameView({ id, role, state, expiresAt: Date.now() + 86_400_000, processing });
}

async function stubGame(
  page: Page,
  options: { id: string; role?: Role; verdict?: Verdict; turnStatus?: number },
): Promise<{ getState: () => GameState }> {
  const role = options.role ?? "innocent";
  const evaluations = fixtureEvaluations[options.verdict ?? "released"];
  let state = initialState();

  await page.route(`**/api/games/${options.id}`, async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(fixtureView(options.id, role, state)) });
  });
  await page.route(`**/api/games/${options.id}/turns`, async (route) => {
    if (options.turnStatus) {
      await route.fulfill({
        status: options.turnStatus,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "RATE_LIMITED", message: "The judgment quota has been reached.", retryAt: new Date(Date.now() + 60_000).toISOString() } }),
      });
      return;
    }
    const body = JSON.parse(route.request().postData() ?? "{}") as { round?: number; statement?: string };
    const evaluation = evaluations[state.turns.length];
    if (!evaluation || body.round !== state.turns.length + 1 || typeof body.statement !== "string") {
      await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: { code: "STALE_ROUND", message: "That round is no longer current." } }) });
      return;
    }
    state = applyTurn(state, body.statement, evaluation);
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(fixtureView(options.id, role, state)) });
  });

  return { getState: () => state };
}

async function openFixture(page: Page, id: string): Promise<void> {
  await page.goto(`/play/${id}`);
  await expect(page.getByRole("heading", { name: CASE_TITLE })).toBeVisible();
}

async function submitStatement(page: Page, statement: string): Promise<void> {
  const composer = page.getByLabel("Your statement · private response");
  await composer.fill(statement);
  await page.getByRole("button", { name: "Submit statement" }).click();
}

async function openWalkthrough(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Walkthrough/ }).click();
  await expect(page.locator(".driver-popover")).toBeVisible();
}

async function expectWalkthroughStep(page: Page, title: string): Promise<void> {
  await expect(page.locator(".driver-popover-title")).toHaveText(title);
}

test("creates a local case, refreshes ownership, and resumes a disabled-AI draft", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Case file").selectOption("fest-fund");
  await page.getByRole("button", { name: /Guilty/ }).click();
  await expect(page.getByRole("button", { name: /Guilty/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".cipher-title")).toContainText("ALIBI.exe");
  await page.screenshot({ path: "test-results/alibi-home.png", fullPage: true });

  await page.getByRole("button", { name: "Enter the interview" }).click();
  await expect(page).toHaveURL(/\/play\/[A-Za-z0-9_-]+$/);
  await expect(page.getByRole("heading", { name: CASE_TITLE })).toBeVisible();
  await page.screenshot({ path: "test-results/alibi-play.png", fullPage: true });

  const draft = "I was checking the festival closeout in the corridor.";
  await page.getByLabel("Your statement · private response").fill(draft);
  await expect(page.getByRole("button", { name: "Submit statement" })).toBeEnabled();
  await page.getByRole("button", { name: "Submit statement" }).click();
  await expect(page.locator('.error-box[role="alert"]')).toContainText("judgment service is disabled");
  await expect(page.getByLabel("Your statement · private response")).toHaveValue(draft);

  await page.reload();
  await expect(page.getByRole("heading", { name: CASE_TITLE })).toBeVisible();
  await expect(page.getByLabel("Your statement · private response")).toHaveValue(draft);

  await page.getByRole("button", { name: "Return to home" }).click();
  await expect(page).toHaveURL(/\/$/);
  const resume = page.getByRole("button", { name: "Resume last file" });
  await expect(resume).toBeVisible();
  await resume.click();
  await expect(page).toHaveURL(/\/play\/[A-Za-z0-9_-]+$/);
  await expect(page.getByRole("heading", { name: CASE_TITLE })).toBeVisible();
});

test("persists a selected case and role briefing through the opened file", async ({ page }) => {
  const id = "fixture-selected-case";
  const view = fixtureView(id, "guilty", initialState("exam-leak", 0));
  let createBody: { role?: string; caseId?: string } = {};
  await page.route("**/api/games", async (route) => {
    createBody = JSON.parse(route.request().postData() ?? "{}");
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(view) });
  });
  await page.route(`**/api/games/${id}`, async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(view) });
  });

  await page.goto("/");
  await page.getByLabel("Case file").selectOption("exam-leak");
  await expect(page.locator(".case-summary")).toContainText("The Exam Paper Leak");
  await page.getByRole("button", { name: /Guilty/ }).click();
  await expect(page.locator(".briefing-card p")).toHaveText(CASE_BRIEFINGS["exam-leak"].guilty[0]);
  await page.getByRole("button", { name: "Enter the interview" }).click();

  expect(createBody).toEqual({ role: "guilty", caseId: "exam-leak" });
  await expect(page.getByRole("heading", { name: "The Exam Paper Leak" })).toBeVisible();
  await page.getByText("Reopen private briefing").click();
  await expect(page.locator(".private-briefing p")).toHaveText(CASE_BRIEFINGS["exam-leak"].guilty[0]);
});

test("keeps random assignment details and its role briefing after navigation", async ({ page }) => {
  const id = "fixture-random-case";
  const view = fixtureView(id, "innocent", initialState("missing-trophy", 1));
  let createBody: { role?: string; caseId?: string } = {};
  await page.route("**/api/games", async (route) => {
    createBody = JSON.parse(route.request().postData() ?? "{}");
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(view) });
  });
  await page.route(`**/api/games/${id}`, async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(view) });
  });

  await page.goto("/");
  await expect(page.getByLabel("Case file")).toHaveValue("random");
  await expect(page.locator(".briefing-note")).toContainText("assigned on start");
  await expect(page.locator(".briefing-card p")).toContainText("legitimate reason");
  await page.getByRole("button", { name: "Enter the interview" }).click();

  expect(createBody).toEqual({ role: "innocent", caseId: "random" });
  await expect(page.getByRole("heading", { name: "The Missing Trophy" })).toBeVisible();
  await page.getByText("Reopen private briefing").click();
  await expect(page.locator(".private-briefing p")).toHaveText(CASE_BRIEFINGS["missing-trophy"].innocent[1]);
});

test("walkthrough supports next, back, skip, and replay with focus cleanup", async ({ page }) => {
  const id = "fixture-walkthrough";
  await stubGame(page, { id });
  await openFixture(page, id);

  const trigger = page.getByRole("button", { name: /Walkthrough/ });
  await openWalkthrough(page);
  await expectWalkthroughStep(page, "Private briefing");
  await expect(page.locator(".driver-popover-progress-text")).toHaveText("1 / 6");

  await page.getByRole("button", { name: "Next" }).click();
  await expectWalkthroughStep(page, "Suspicion meter");
  await page.getByRole("button", { name: "Back" }).click();
  await expectWalkthroughStep(page, "Private briefing");

  await page.getByRole("button", { name: "Skip walkthrough" }).click();
  await expect(page.locator(".driver-popover")).toBeHidden();
  await expect(trigger).toBeFocused();

  await openWalkthrough(page);
  await expectWalkthroughStep(page, "Private briefing");
  await page.keyboard.press("Escape");
  await expect(page.locator(".driver-popover")).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("walkthrough finishes with Done and restores its original tab", async ({ page }) => {
  const id = "fixture-walkthrough-done";
  await stubGame(page, { id });
  await openFixture(page, id);
  const trigger = page.getByRole("button", { name: /Walkthrough/ });
  await openWalkthrough(page);

  for (const title of ["Suspicion meter", "Evidence timeline", "Current question", "Shared transcript", "Your response"]) {
    await page.getByRole("button", { name: "Next" }).click();
    await expectWalkthroughStep(page, title);
  }
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.locator(".driver-popover")).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.locator(".play-layout")).toHaveAttribute("data-tab", "interrogation");
});

test("walkthrough switches mobile panels for evidence and restores interrogation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const id = "fixture-walkthrough-mobile";
  await stubGame(page, { id });
  await openFixture(page, id);
  const trigger = page.getByRole("button", { name: /Walkthrough/ });
  await page.locator(".mobile-tab").nth(1).click();
  await expect(page.locator(".play-layout")).toHaveAttribute("data-tab", "evidence");
  await openWalkthrough(page);
  await expectWalkthroughStep(page, "Private briefing");
  await expect(page.locator(".play-layout")).toHaveAttribute("data-tab", "interrogation");

  await page.getByRole("button", { name: "Next" }).click();
  await expectWalkthroughStep(page, "Suspicion meter");
  await page.getByRole("button", { name: "Next" }).click();
  await expectWalkthroughStep(page, "Evidence timeline");
  await expect(page.locator(".play-layout")).toHaveAttribute("data-tab", "evidence");
  await expect(page.locator(".evidence-panel")).toBeVisible();

  await page.getByRole("button", { name: "Next" }).click();
  await expectWalkthroughStep(page, "Current question");
  await expect(page.locator(".play-layout")).toHaveAttribute("data-tab", "interrogation");
  await page.keyboard.press("Escape");
  await expect(page.locator(".driver-popover")).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.locator(".play-layout")).toHaveAttribute("data-tab", "evidence");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

for (const ending of [
  { verdict: "released" as const, role: "innocent" as const },
  { verdict: "under_suspicion" as const, role: "guilty" as const },
  { verdict: "caught" as const, role: "innocent" as const },
]) {
  test(`records five rounds and persists the ${ending.verdict.replaceAll("_", " ")} ending`, async ({ page }) => {
    const id = `fixture-${ending.verdict}`;
    const fixture = await stubGame(page, { id, role: ending.role, verdict: ending.verdict });
    await openFixture(page, id);

    for (let round = 1; round <= 5; round += 1) {
      await submitStatement(page, `Round ${round} statement with enough detail for the record.`);
    }

    await expect(page.getByText(`Final verdict · ${ending.verdict.replaceAll("_", " ")}`)).toBeVisible();
    await expect(page.getByText("5 recorded answers")).toBeVisible();
    await expect(page.locator("article.turn")).toHaveCount(5);
    await expect(page.getByText("Round 5 statement with enough detail for the record.")).toBeVisible();
    expect(fixture.getState().turns).toHaveLength(5);

    await page.reload();
    await expect(page.getByText(`Final verdict · ${ending.verdict.replaceAll("_", " ")}`)).toBeVisible();
    await expect(page.locator("article.turn")).toHaveCount(5);
    await expect(page.getByText("Round 1 statement with enough detail for the record.")).toBeVisible();
  });
}

test("closes evidence with Escape and restores focus to the evidence item", async ({ page }) => {
  const id = "fixture-dialog";
  await stubGame(page, { id });
  await openFixture(page, id);

  const evidence = page.getByRole("button", { name: /Open evidence:/ }).first();
  await evidence.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Close evidence" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(evidence).toBeFocused();
});

test("keeps mobile tabs usable without horizontal overflow under reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const id = "fixture-mobile";
  await stubGame(page, { id });
  await openFixture(page, id);

  await expect(page.locator(".mobile-tab").first()).toBeVisible();
  await expect(page.locator(".mobile-tab").nth(1)).toBeVisible();
  await expect(page.locator(".composer-hint")).toHaveText(/0.*5.*600/);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);

  await page.getByLabel("Your statement · private response").fill("four");
  await expect(page.getByRole("button", { name: "Submit statement" })).toBeDisabled();
  await page.getByLabel("Your statement · private response").fill("five!");
  await expect(page.getByRole("button", { name: "Submit statement" })).toBeEnabled();
  await page.locator(".mobile-tab").nth(1).click();
  await expect(page.locator(".evidence-panel")).toBeVisible();
  await expect(page.locator(".interrogation")).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("preserves the draft after a 429 response", async ({ page }) => {
  const id = "fixture-429";
  await stubGame(page, { id, turnStatus: 429 });
  await openFixture(page, id);

  const draft = "Keep this exact statement while the quota is unavailable.";
  await page.getByLabel("Your statement · private response").fill(draft);
  await page.getByRole("button", { name: "Submit statement" }).click();
  await expect(page.locator('.error-box[role="alert"]')).toContainText("judgment quota has been reached");
  await expect(page.getByLabel("Your statement · private response")).toHaveValue(draft);
});
