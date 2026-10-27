import { CASES, CASE_IDS, CASE_VERSION } from "./case";
import { CASE_BRIEFINGS } from "./briefings";
import type {
  BriefingVariant,
  CaseDefinition,
  CaseId,
  Evaluation,
  GameState,
  GameView,
  Reaction,
  Role,
  Verdict,
} from "./types";

const REACTIONS: readonly Reaction[] = ["accept", "probe", "challenge", "confession"];

export function initialState(caseId: CaseId = "fest-fund", briefingVariant: BriefingVariant = 0): GameState {
  if (!CASE_IDS.includes(caseId) || ![0, 1].includes(briefingVariant)) {
    throw new Error("Unknown case or briefing variant");
  }

  return {
    caseVersion: CASE_VERSION,
    caseId,
    briefingVariant,
    turns: [],
    suspicion: 0,
    confessed: false,
  };
}

/** Resolve persisted state while allowing the pre-case-selection shape to load as fest-fund. */
export function getCase(state: GameState): CaseDefinition {
  const caseId = (state as { caseId?: unknown }).caseId;
  if (caseId === undefined) return CASES["fest-fund"];
  if (typeof caseId !== "string" || !CASE_IDS.includes(caseId as CaseId)) {
    throw new Error(`Unknown case: ${String(caseId)}`);
  }
  return CASES[caseId as CaseId];
}

function normalizeState(state: GameState): GameState {
  if (state.caseVersion !== CASE_VERSION) throw new Error("Unsupported case version");

  const selectedCase = getCase(state);
  const rawVariant = (state as { briefingVariant?: unknown }).briefingVariant;
  const briefingVariant = rawVariant === undefined ? 0 : rawVariant;
  if (briefingVariant !== 0 && briefingVariant !== 1) {
    throw new Error("Unknown briefing variant");
  }

  return {
    ...state,
    caseId: selectedCase.id,
    briefingVariant,
  };
}

export function normalizeEvaluation(value: unknown): Evaluation {
  if (typeof value !== "object" || value === null) {
    throw new Error("Evaluation must be an object");
  }

  const candidate = value as { reaction?: unknown; confidence?: unknown };
  if (
    typeof candidate.reaction !== "string" ||
    !REACTIONS.includes(candidate.reaction as Reaction) ||
    typeof candidate.confidence !== "number" ||
    !Number.isFinite(candidate.confidence) ||
    candidate.confidence < 0 ||
    candidate.confidence > 1
  ) {
    throw new Error("Evaluation is invalid");
  }

  return {
    reaction: candidate.confidence < 0.65 ? "probe" : (candidate.reaction as Reaction),
    confidence: candidate.confidence,
  };
}

export function applyTurn(state: GameState, statement: string, evaluation: Evaluation): GameState {
  const normalizedState = normalizeState(state);
  if (normalizedState.turns.length >= 5) {
    throw new Error("The case has exactly five rounds");
  }

  const normalized = normalizeEvaluation(evaluation);
  const selectedCase = getCase(normalizedState);
  const round = normalizedState.turns.length + 1;
  const suspicionAdded = normalized.reaction === "accept" ? 0 : normalized.reaction === "probe" ? 1 : 2;

  return {
    caseVersion: normalizedState.caseVersion,
    caseId: normalizedState.caseId,
    briefingVariant: normalizedState.briefingVariant,
    turns: [
      ...normalizedState.turns,
      {
        round,
        statement,
        reaction: normalized.reaction,
        detectiveReply: selectedCase.replies[round][normalized.reaction],
        suspicionAdded,
      },
    ],
    suspicion: normalizedState.suspicion + suspicionAdded,
    confessed: normalizedState.confessed || normalized.reaction === "confession",
  };
}

export function verdictFor(state: GameState): Verdict | null {
  if (state.turns.length !== 5) return null;
  if (state.confessed || state.suspicion >= 6) return "caught";
  if (state.suspicion >= 3) return "under_suspicion";
  return "released";
}

export function toGameView(input: {
  id: string;
  role: Role;
  state: GameState;
  expiresAt: number;
  processing: boolean;
}): GameView {
  const state = normalizeState(input.state);
  const selectedCase = getCase(state);
  const round = Math.min(Math.max(state.turns.length + 1, 1), 5);
  const evidence = selectedCase.evidence.slice(0, round);
  const verdict = verdictFor(state);

  return {
    id: input.id,
    role: input.role,
    caseId: selectedCase.id,
    caseTitle: selectedCase.title,
    caseSummary: selectedCase.summary,
    briefing: CASE_BRIEFINGS[selectedCase.id][input.role][state.briefingVariant],
    round,
    totalRounds: 5,
    status: verdict === null ? "playing" : "finished",
    suspicion: state.suspicion,
    evidence,
    turns: state.turns.map((turn) => ({ ...turn })),
    question: verdict === null ? evidence[round - 1]?.question ?? null : null,
    verdict,
    epilogue: verdict === null ? null : selectedCase.epilogues[input.role][verdict],
    expiresAt: input.expiresAt,
    processing: input.processing,
  };
}
