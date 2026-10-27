"use client";

import { useEffect, useState } from "react";
import { ArrowRight, LockKeyhole, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { CASE_BRIEFINGS, CASE_OPTIONS } from "@/lib/game/briefings";
import type { CaseId, Role } from "@/lib/game/types";

const GAME_STORAGE_KEY = "alibi:last-game";
type CaseSelection = CaseId | "random";

const RANDOM_BRIEFINGS: Record<Role, string> = {
  innocent: "You have a legitimate reason to be near the case's evidence. Keep the ordinary details clear and separate what you know from what the record only suggests.",
  guilty: "You are responsible for the missing item in the case you receive. Keep your cover story narrow, consistent, and inside the evidence the detective reveals.",
};

export default function HomePage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("innocent");
  const [caseSelection, setCaseSelection] = useState<CaseSelection>("random");
  const [savedGame, setSavedGame] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedCase = CASE_OPTIONS.find((option) => option.id === caseSelection);
  const currentBriefing = caseSelection === "random"
    ? RANDOM_BRIEFINGS[role]
    : CASE_BRIEFINGS[caseSelection][role][0];

  useEffect(() => {
    let cancelled = false;
    let candidate: string | null = null;
    try { candidate = window.localStorage.getItem(GAME_STORAGE_KEY); } catch { candidate = null; }
    if (!candidate) return;
    void fetch(`/api/games/${encodeURIComponent(candidate)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return await response.json() as { status?: string };
      })
      .then((payload) => {
        if (!cancelled && payload?.status === "playing") setSavedGame(candidate);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  async function startGame() {
    setStarting(true);
    setError(null);
    try {
      const response = await fetch("/api/games", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role, caseId: caseSelection }),
      });
      const payload = await response.json().catch(() => null) as { id?: string; error?: { message?: string } } | null;
      if (!response.ok || !payload?.id) throw new Error(payload?.error?.message ?? "The case file could not be opened.");
      try { window.localStorage.setItem(GAME_STORAGE_KEY, payload.id); } catch { /* private browsers may deny storage */ }
      router.push(`/play/${encodeURIComponent(payload.id)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The case file could not be opened.");
      setStarting(false);
    }
  }

  function resumeGame() {
    if (savedGame) router.push(`/play/${encodeURIComponent(savedGame)}`);
  }

  return (
    <div className="shell home-shell">
      <header className="home-header">
        <a className="brand" href="/" aria-label="ALIBI.exe home"><span className="brand-mark">//</span><span className="brand-word">ALIBI.exe</span><span className="brand-version">v1.0</span></a>
        <span className="eyebrow">INTERVIEW ROOM 01</span>
      </header>

      <main className="home-main">
        <div className="home-layout">
          <section className="home-hero" aria-labelledby="home-title">
            <div className="eyebrow">A playable case file</div>
            <h1 id="home-title" className="display cipher-title"><span data-face>ALIBI.exe</span></h1>
            <h2 className="display home-subhead">Tell it straight.</h2>
            <p>Five rounds. One shared record. Every answer changes how Detective Sen reads the room.</p>
            <div className="case-summary">
              <span>{selectedCase?.title ?? "3 possible case files"}</span>
              <span>{selectedCase?.summary ?? "The detective assigns one of three cases when you enter."}</span>
            </div>
            <p className="rules-note">Five rounds · three endings · no timer · saved for 7 days</p>
          </section>

          <div className="home-side">
            <div className="home-actions">
              <button className="button button-primary" type="button" onClick={startGame} disabled={starting}>
                {starting ? <span className="spinner" aria-hidden="true" /> : <ArrowRight size={18} strokeWidth={2.5} aria-hidden="true" />}
                {starting ? "Opening file…" : "Enter the interview"}
              </button>
              {savedGame && <button className="button button-ghost" type="button" onClick={resumeGame} disabled={starting}><RotateCcw size={17} strokeWidth={2.5} aria-hidden="true" /> Resume last file</button>}
            </div>
            <div className="home-grid">
              <section className="role-panel" aria-labelledby="role-title">
                <div className="panel-label"><span id="role-title">Choose your file</span><span>01 / 02</span></div>
                <div className="case-picker">
                  <label htmlFor="case-file">Case file</label>
                  <select id="case-file" value={caseSelection} onChange={(event) => setCaseSelection(event.target.value as CaseSelection)}>
                    <option value="random">Surprise me</option>
                    {CASE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}
                  </select>
                  <p>{selectedCase?.summary ?? "Three possible cases. Your assignment is revealed when the interview opens."}</p>
                </div>
                <div className="role-grid" role="group" aria-label="Choose your role">
                  <button type="button" className="role-card" data-selected={role === "innocent"} aria-pressed={role === "innocent"} onClick={() => setRole("innocent")}>
                    <span className="role-mark">A — THE COORDINATOR</span>
                    <strong>Innocent</strong>
                    <span>You had a legitimate reason to be there. Make the ordinary details hold.</span>
                  </button>
                  <button type="button" className="role-card" data-selected={role === "guilty"} aria-pressed={role === "guilty"} onClick={() => setRole("guilty")}>
                    <span className="role-mark">B — THE COVER STORY</span>
                    <strong>Guilty</strong>
                    <span>You did it. Keep your cover story consistent as the evidence arrives.</span>
                  </button>
                </div>
              </section>

              <aside className="briefing-card" aria-labelledby="briefing-title">
                <LockKeyhole className="briefing-lock" size={22} strokeWidth={2.5} aria-hidden="true" />
                <h2 id="briefing-title">Your private briefing</h2>
                <p>{currentBriefing}</p>
                {caseSelection === "random" && <small className="briefing-note">Your case and its specific details are assigned on start.</small>}
              </aside>
            </div>

            {error && <div className="error-box" role="alert">{error}</div>}
          </div>
        </div>
      </main>

      <footer className="home-footer"><span>NO ACCOUNTS · 3 CASE FILES · NO TIMER</span><span>RESUME IN THIS BROWSER · EXPIRES IN 7 DAYS</span></footer>
    </div>
  );
}
