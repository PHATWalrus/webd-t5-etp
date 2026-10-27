import { describe, expect, test } from "bun:test";

import { CASES, CASE_IDS, CASE_TITLE, CASE_VERSION, EVIDENCE, EPILOGUES } from "../src/lib/game/case";
import { BRIEFINGS, CASE_BRIEFINGS } from "../src/lib/game/briefings";
import {
  applyTurn,
  getCase,
  initialState,
  normalizeEvaluation,
  toGameView,
  verdictFor,
} from "../src/lib/game/rules";
import type { Evaluation, GameState, Reaction, Role } from "../src/lib/game/types";

const evaluation = (reaction: Reaction, confidence = 0.9): Evaluation => ({ reaction, confidence });

function play(state: GameState, reactions: Reaction[]): GameState {
  return reactions.reduce(
    (current, reaction, index) => applyTurn(current, `statement ${index + 1}`, evaluation(reaction)),
    state,
  );
}

describe("ALIBI.exe case rules", () => {
  test("normalizes low confidence to a probe and rejects malformed evaluations", () => {
    expect(normalizeEvaluation({ reaction: "confession", confidence: 0.64 })).toEqual({
      reaction: "probe",
      confidence: 0.64,
    });
    expect(normalizeEvaluation({ reaction: "challenge", confidence: 0.65 })).toEqual({
      reaction: "challenge",
      confidence: 0.65,
    });

    for (const value of [
      undefined,
      null,
      {},
      { reaction: "wrong", confidence: 0.9 },
      { reaction: "accept", confidence: Number.NaN },
      { reaction: "accept", confidence: Number.POSITIVE_INFINITY },
      { reaction: "accept", confidence: -0.01 },
      { reaction: "accept", confidence: 1.01 },
    ]) {
      expect(() => normalizeEvaluation(value)).toThrow();
    }
  });

  test("applies immutable turn deltas and rejects a sixth round", () => {
    const before = initialState();
    const after = applyTurn(before, "I was at the booth.", evaluation("challenge"));

    expect(before).toEqual({
      caseVersion: 1,
      caseId: "fest-fund",
      briefingVariant: 0,
      turns: [],
      suspicion: 0,
      confessed: false,
    });
    expect(after).not.toBe(before);
    expect(after.turns).not.toBe(before.turns);
    expect(after.suspicion).toBe(2);
    expect(after.turns[0]?.suspicionAdded).toBe(2);

    const finished = play(after, ["accept", "probe", "accept", "accept"]);
    expect(finished.turns).toHaveLength(5);
    expect(() => applyTurn(finished, "one more thing", evaluation("accept"))).toThrow();
  });

  test("classifies score 2, 3, 5, and 6 after five rounds", () => {
    expect(verdictFor(play(initialState(), ["challenge", "accept", "accept", "accept", "accept"]))).toBe(
      "released",
    );
    expect(verdictFor(play(initialState(), ["challenge", "probe", "accept", "accept", "accept"]))).toBe(
      "under_suspicion",
    );
    expect(verdictFor(play(initialState(), ["challenge", "challenge", "probe", "accept", "accept"]))).toBe(
      "under_suspicion",
    );
    expect(verdictFor(play(initialState(), ["challenge", "challenge", "challenge", "accept", "accept"]))).toBe(
      "caught",
    );
  });

  test("requires all five rounds even after a confession", () => {
    let state = applyTurn(initialState(), "I took the cash.", evaluation("confession"));
    expect(state.confessed).toBe(true);
    expect(verdictFor(state)).toBeNull();

    state = play(state, ["accept", "accept", "accept", "accept"]);
    expect(state.turns).toHaveLength(5);
    expect(verdictFor(state)).toBe("caught");
  });

  test("keeps the public evidence window ahead by one round", () => {
    const input = { id: "game-1", role: "innocent" as const, expiresAt: 123, processing: false };
    const first = toGameView({ ...input, state: initialState() });
    expect(first.round).toBe(1);
    expect(first.evidence).toHaveLength(1);
    expect(first.evidence[0]?.id).toBe(EVIDENCE[0]?.id);
    expect(first.question).toBe(EVIDENCE[0]?.question);
    expect(first.evidence.some((item) => item.id === EVIDENCE[1]?.id)).toBe(false);

    const secondState = applyTurn(initialState(), "I was backstage.", evaluation("accept"));
    const second = toGameView({ ...input, state: secondState });
    expect(second.evidence).toHaveLength(2);
    expect(second.question).toBe(EVIDENCE[1]?.question);

    const finishedState = play(initialState(), ["accept", "accept", "accept", "accept", "accept"]);
    const finished = toGameView({ ...input, state: finishedState });
    expect(finished.round).toBe(5);
    expect(finished.evidence).toHaveLength(5);
    expect(finished.status).toBe("finished");
    expect(finished.question).toBeNull();
    expect(finished.epilogue).toBe(EPILOGUES.innocent.released);
  });

  test("gives both roles identical public answers and role-specific epilogues", () => {
    const state = play(initialState(), ["accept", "probe", "challenge", "accept", "accept"]);
    const innocent = toGameView({ id: "i", role: "innocent", state, expiresAt: 1, processing: false });
    const guilty = toGameView({ id: "g", role: "guilty", state, expiresAt: 1, processing: false });

    expect(guilty.evidence).toEqual(innocent.evidence);
    expect(guilty.turns).toEqual(innocent.turns);
    expect(guilty.question).toEqual(innocent.question);
    expect(guilty.suspicion).toBe(innocent.suspicion);
    expect(guilty.briefing).not.toBe(innocent.briefing);
    expect(guilty.epilogue).not.toBe(innocent.epilogue);
    expect(new Set<Role>(["guilty", "innocent"])).toEqual(
      new Set<Role>(Object.keys(BRIEFINGS) as Role[]),
    );
  });

  test("defines three cases with exactly five public clues and two role briefings", () => {
    expect(CASE_IDS).toEqual(["fest-fund", "exam-leak", "missing-trophy"]);
    expect(CASE_VERSION).toBe(1);

    for (const caseId of CASE_IDS) {
      const definition = CASES[caseId];
      expect(definition.evidence).toHaveLength(5);
      expect(definition.evidence.map((item) => item.round)).toEqual([1, 2, 3, 4, 5]);
      expect(definition.replies[1]).toHaveProperty("challenge");
      expect(definition.epilogues.innocent).toHaveProperty("caught");
      expect(CASE_BRIEFINGS[caseId].innocent).toHaveLength(2);
      expect(CASE_BRIEFINGS[caseId].guilty).toHaveLength(2);
    }
  });

  test("freezes case and briefing variant while revealing one clue per round", () => {
    for (const caseId of CASE_IDS) {
      const state = initialState(caseId, 1);
      const input = { id: caseId, role: "innocent" as const, state, expiresAt: 1, processing: false };
      const first = toGameView(input);
      expect(first.caseId).toBe(caseId);
      expect(first.briefing).toBe(CASE_BRIEFINGS[caseId].innocent[1]);
      expect(first.evidence).toHaveLength(1);
      expect(first.evidence).toEqual(CASES[caseId].evidence.slice(0, 1));
      expect(first.evidence).not.toContain(CASES[caseId].evidence[1]);

      const secondState = applyTurn(state, "I was there for an authorized task.", evaluation("accept"));
      const second = toGameView({ ...input, state: secondState });
      expect(second.caseId).toBe(caseId);
      expect(second.evidence).toEqual(CASES[caseId].evidence.slice(0, 2));
      expect(second.evidence).not.toContain(CASES[caseId].evidence[2]);
      expect(second.status).toBe("playing");
    }
  });

  test("loads legacy states as fest-fund variant zero and rejects unknown cases", () => {
    const legacy = { ...initialState() } as Partial<GameState> as GameState;
    delete (legacy as Partial<GameState>).caseId;
    delete (legacy as Partial<GameState>).briefingVariant;
    expect(getCase(legacy).id).toBe("fest-fund");
    expect(toGameView({ id: "legacy", role: "innocent", state: legacy, expiresAt: 1, processing: false }).caseId).toBe(
      "fest-fund",
    );
    expect(() => getCase({ ...initialState(), caseId: "unknown" } as unknown as GameState)).toThrow(
      "Unknown case",
    );
    expect(() => toGameView({
      id: "legacy-null-variant",
      role: "innocent",
      state: { ...initialState(), briefingVariant: null } as unknown as GameState,
      expiresAt: 1,
      processing: false,
    })).toThrow("Unknown briefing variant");
    expect(CASE_TITLE).toBe("The Missing Fest Fund");
  });
});
