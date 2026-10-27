export type Role = "guilty" | "innocent";
export type Reaction = "accept" | "probe" | "challenge" | "confession";
export type Verdict = "released" | "under_suspicion" | "caught";
export type CaseId = "fest-fund" | "exam-leak" | "missing-trophy";
export type BriefingVariant = 0 | 1;

export interface Evidence {
  id: string;
  round: number;
  time: string;
  title: string;
  kind: "observation" | "record" | "allegation";
  summary: string;
  detail: string;
  limitation: string;
  question: string;
  image: string;
}

export interface Evaluation {
  reaction: Reaction;
  confidence: number;
}

export interface Turn {
  round: number;
  statement: string;
  reaction: Reaction;
  detectiveReply: string;
  suspicionAdded: number;
}

export interface CaseDefinition {
  id: CaseId;
  title: string;
  summary: string;
  accusation: string;
  confessionTarget: string;
  evidence: Evidence[];
  replies: Record<number, Record<Reaction, string>>;
  epilogues: Record<Role, Record<Verdict, string>>;
}

export interface GameState {
  caseVersion: 1;
  caseId: CaseId;
  briefingVariant: BriefingVariant;
  turns: Turn[];
  suspicion: number;
  confessed: boolean;
}

export interface GameView {
  id: string;
  role: Role;
  caseId: CaseId;
  caseTitle: string;
  caseSummary: string;
  briefing: string;
  round: number;
  totalRounds: 5;
  status: "playing" | "finished";
  suspicion: number;
  evidence: Evidence[];
  turns: Turn[];
  question: string | null;
  verdict: Verdict | null;
  epilogue: string | null;
  expiresAt: number;
  processing: boolean;
}

export interface ApiErrorBody {
  error: { code: string; message: string; retryAt?: string };
}
