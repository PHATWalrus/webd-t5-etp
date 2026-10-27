"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, FileText, LoaderCircle, Radio, ShieldAlert } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { EvidenceDialog } from "@/components/evidence-dialog";
import { Transcript } from "@/components/transcript";
import { Walkthrough } from "@/components/walkthrough";
import type { Evidence, GameView, Role } from "@/lib/game/types";

const GAME_STORAGE_KEY = "alibi:last-game";
const MAX_POLL_ATTEMPTS = 8;

type ErrorPayload = { error?: { code?: string; message?: string; retryAt?: string } };

function roleLabel(role: Role) {
  return role === "guilty" ? "FILE B · COVER STORY" : "FILE A · COORDINATOR";
}

function suspicionLabel(value: number) {
  if (value >= 6) return "critical scrutiny";
  if (value >= 3) return "elevated scrutiny";
  return "low scrutiny";
}

function draftStorageKey(id: string, round: number) {
  return `alibi:draft:${id}:${round}`;
}

export default function PlayPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = typeof params?.id === "string" ? decodeURIComponent(params.id) : "";
  const [view, setView] = useState<GameView | null>(null);
  const [draft, setDraft] = useState("");
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);
  const [tab, setTab] = useState<"interrogation" | "evidence">("interrogation");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const pollAttempts = useRef(0);

  const loadGame = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);
    try {
      const response = await fetch(`/api/games/${encodeURIComponent(id)}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null) as GameView | ErrorPayload | null;
      if (!response.ok || !payload || !("id" in payload)) {
        throw new Error((payload as ErrorPayload | null)?.error?.message ?? "This case file is not available.");
      }
      setView(payload);
      try { window.localStorage.setItem(GAME_STORAGE_KEY, payload.id); } catch { /* private browsers may deny storage */ }
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This case file is not available.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id]);

  useEffect(() => { void loadGame(); }, [loadGame]);

  useEffect(() => {
    if (!view || view.processing) return;
    const key = draftStorageKey(id, view.round);
    try { setDraft(window.sessionStorage.getItem(key) ?? ""); } catch { setDraft(""); }
  }, [id, view?.round, view?.processing]);

  useEffect(() => {
    if (!view?.processing) {
      pollAttempts.current = 0;
      return;
    }
    let cancelled = false;
    const poll = async () => {
      if (cancelled || pollAttempts.current >= MAX_POLL_ATTEMPTS) return;
      pollAttempts.current += 1;
      await loadGame(true);
      if (!cancelled && pollAttempts.current < MAX_POLL_ATTEMPTS) window.setTimeout(poll, 4000);
    };
    const timer = window.setTimeout(poll, 800);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [loadGame, view?.processing]);

  const closeEvidence = useCallback(() => setSelectedEvidence(null), []);
  const currentDraftKey = view ? draftStorageKey(id, view.round) : "";

  function updateDraft(value: string) {
    setDraft(value);
    if (!currentDraftKey) return;
    try { window.sessionStorage.setItem(currentDraftKey, value); } catch { /* storage is best effort; the in-memory draft remains */ }
  }

  async function submitTurn() {
    const statement = draft.trim();
    const codePointLength = Array.from(statement).length;
    if (!view || !statement || submitting || view.status === "finished") return;
    if (codePointLength < 5 || codePointLength > 600) {
      setError("Keep the statement between 5 and 600 characters.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/games/${encodeURIComponent(id)}/turns`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ round: view.round, statement }),
      });
      const payload = await response.json().catch(() => null) as GameView | ErrorPayload | null;
      if (!response.ok || !payload || !("id" in payload)) {
        const apiError = (payload as ErrorPayload | null)?.error;
        const retry = apiError?.retryAt ? ` Try again after ${new Date(apiError.retryAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.` : "";
        if (apiError?.code === "IN_PROGRESS" || apiError?.code === "TURN_IN_PROGRESS") void loadGame(true);
        throw new Error(`${apiError?.message ?? "The statement was not accepted."}${retry}`);
      }
      try { window.sessionStorage.removeItem(currentDraftKey); } catch { /* storage is best effort */ }
      setDraft("");
      setView(payload);
      setAnnouncement(payload.status === "finished" ? "The case is complete. Verdict available." : `Round ${payload.round} is open. New evidence is available.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The statement was not accepted.");
      setAnnouncement("The statement was not accepted. Your draft is preserved.");
    } finally {
      setSubmitting(false);
    }
  }

  const evidenceCount = view?.evidence.length ?? 0;
  const scrutiny = useMemo(() => Math.min(100, ((view?.suspicion ?? 0) / 10) * 100), [view?.suspicion]);
  const statementLength = Array.from(draft.trim()).length;
  const statementValid = statementLength >= 5 && statementLength <= 600;

  if (loading) return <div className="shell play-shell loading-state"><span className="spinner" aria-label="Loading case" /></div>;

  return (
    <div className="shell play-shell">
      <header className="play-header">
        <button className="brand" type="button" onClick={() => router.push("/")} aria-label="Return to home"><span className="brand-mark">//</span><span className="brand-word">ALIBI.exe</span></button>
        <div className="play-header-tools"><div className="play-meta"><span>{view ? roleLabel(view.role) : "CASE FILE"}</span><span className="hide-mobile">·</span><span className="hide-mobile">PRIVATE SESSION</span></div>{view && <Walkthrough tab={tab} setTab={setTab} />}</div>
      </header>

      <main className="play-main">
        {!view ? (
          <div className="error-box" role="alert">{error ?? "This case file is not available."}</div>
        ) : <>
          <div className="play-title-row">
            <div>
              <div className="round-label">{view.status === "finished" ? "File closed" : `Round ${String(view.round).padStart(2, "0")} of ${view.totalRounds}`}</div>
              <h1 className="display">{view.caseTitle}</h1>
              <p className="case-summary-play">{view.caseSummary}</p>
            </div>
            <div className="meter-wrap" data-tour="suspicion" aria-label={`Detective suspicion ${view.suspicion} out of 10, ${suspicionLabel(view.suspicion)}`}>
              <div className="meter-label"><span>Detective suspicion</span><span>{view.suspicion} / 10</span></div>
              <div className="meter-track"><div className="meter-fill" style={{ width: `${scrutiny}%` }} /></div>
              <div className="meter-caption">{suspicionLabel(view.suspicion)}</div>
            </div>
          </div>

          <div className="mobile-tabs" data-tour="tabs" aria-label="Case panels">
            <button className="mobile-tab" type="button" aria-pressed={tab === "interrogation"} onClick={() => setTab("interrogation")}><Radio size={15} strokeWidth={2.5} aria-hidden="true" /> Interrogation</button>
            <button className="mobile-tab" type="button" aria-pressed={tab === "evidence"} onClick={() => setTab("evidence")}><FileText size={15} strokeWidth={2.5} aria-hidden="true" /> Evidence ({evidenceCount})</button>
          </div>

          <div className="play-layout" data-tab={tab}>
            <section className="interrogation" aria-labelledby="interrogation-title">
              <div className="section-head"><h2 id="interrogation-title">Interrogation transcript</h2><span>{view.turns.length} recorded {view.turns.length === 1 ? "answer" : "answers"}</span></div>
              <div className="briefing-strip" data-tour="question"><strong>Detective Sen</strong>{view.question ?? "The record is complete. Read the closing statement below."}</div>
              <details className="private-briefing" data-tour="briefing">
                <summary>Reopen private briefing</summary>
                <p>{view.briefing}</p>
              </details>
              <div className="transcript-wrap" data-tour="transcript">{view.turns.length ? <Transcript turns={view.turns} evidence={view.evidence} /> : <div className="transcript"><Transcript turns={view.turns} evidence={view.evidence} /></div>}</div>
              {view.status === "finished" ? (
                <div className="verdict-card" aria-live="polite">
                  <div className="eyebrow">Final verdict · {view.verdict?.replaceAll("_", " ")}</div>
                  <h3>{view.verdict === "caught" ? "The file points to you." : view.verdict === "under_suspicion" ? "The file stays open." : "The file is released."}</h3>
                  <p>{view.epilogue}</p>
                </div>
              ) : <div className="composer" data-tour="composer">
                <label htmlFor="statement">Your statement · private response</label>
                <textarea id="statement" value={draft} onChange={(event) => updateDraft(event.target.value)} placeholder="Answer in your own words. The record keeps the exact statement." maxLength={1200} aria-describedby="statement-hint" disabled={submitting || view.processing} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void submitTurn(); }} />
                <div className="composer-row"><span id="statement-hint" className="composer-hint">{statementLength} / 5–600 code points</span><button className="button button-primary" type="button" onClick={() => void submitTurn()} disabled={!statementValid || submitting || view.processing}>{submitting || view.processing ? <LoaderCircle className="animate-spin" size={17} strokeWidth={2.5} aria-hidden="true" /> : <ArrowLeft size={17} strokeWidth={2.5} className="rotate-180" aria-hidden="true" />}{submitting || view.processing ? "Processing…" : "Submit statement"}</button></div>
              </div>}
            </section>

            <aside className="evidence-panel" data-tour="evidence" aria-labelledby="evidence-title">
              <div className="section-head"><h2 id="evidence-title">Evidence timeline</h2><span>{evidenceCount} revealed</span></div>
              <div className="evidence-list">
                {view.evidence.length === 0 ? <div className="evidence-empty">No public evidence has been released.</div> : view.evidence.map((evidence, index) => <div key={evidence.id}>
                  <button className="evidence-item" type="button" onClick={() => setSelectedEvidence(evidence)} aria-label={`Open evidence: ${evidence.title}`}>
                    <img className="evidence-thumb" src={evidence.image} alt="" />
                    <span><strong>{evidence.title}</strong><small>{evidence.time} · {evidence.kind}</small></span>
                  </button>
                  {index < view.evidence.length - 1 && <div className="evidence-line" aria-hidden="true" />}
                </div>)}
              </div>
              <div className="briefing-strip"><ShieldAlert size={16} strokeWidth={2.5} aria-hidden="true" /> Only revealed public facts appear here.</div>
            </aside>
          </div>
        </>}
      </main>
      {error && view && <div className="play-main" style={{ paddingTop: 0 }}><div className="error-box" role="alert">{error}</div></div>}
      <div className="live-region" aria-live="polite">{announcement}</div>
      {selectedEvidence && <EvidenceDialog evidence={selectedEvidence} onClose={closeEvidence} />}
    </div>
  );
}
