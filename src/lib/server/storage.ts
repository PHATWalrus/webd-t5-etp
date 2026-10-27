import type { D1Database } from "@cloudflare/workers-types";

import type { GameState, Role } from "../game/types";

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
const IST_OFFSET_MS = 19_800_000;
const GAME_TTL_MS = 7 * DAY_MS;
const ATTEMPT_RETENTION_MS = 8 * DAY_MS;

export interface GameRow {
  id: string;
  owner_hash: string;
  ip_hash: string;
  role: Role;
  state_json: string;
  version: number;
  processing_token: string | null;
  processing_until: number | null;
  created_at: number;
  expires_at: number;
}

export function istDay(now: number): string {
  const date = new Date(now + IST_OFFSET_MS);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid server timestamp");
  return date.toISOString().slice(0, 10);
}

export function nextIstMidnight(now: number): number {
  const date = new Date(now + IST_OFFSET_MS);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid server timestamp");
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1) - IST_OFFSET_MS;
}

export async function getGame(db: D1Database, id: string, ownerHash: string, now: number): Promise<GameRow | null> {
  return db
    .prepare(
      `SELECT id, owner_hash, ip_hash, role, state_json, version,
              processing_token, processing_until, created_at, expires_at
         FROM games
        WHERE id = ? AND owner_hash = ? AND expires_at > ?`,
    )
    .bind(id, ownerHash, now)
    .first<GameRow>();
}

export async function createGame(
  db: D1Database,
  input: { id: string; ownerHash: string; ipHash: string; role: Role; state: GameState; now: number },
): Promise<boolean> {
  const dayStart = nextIstMidnight(input.now - DAY_MS);
  const dayEnd = nextIstMidnight(input.now);
  const result = await db
    .prepare(
      `INSERT INTO games
        (id, owner_hash, ip_hash, role, state_json, version, processing_token, processing_until, created_at, expires_at)
       SELECT ?, ?, ?, ?, ?, 0, NULL, NULL, ?, ?
        WHERE (SELECT COUNT(*) FROM games WHERE owner_hash = ? AND created_at >= ? AND created_at < ?) < 10
          AND (SELECT COUNT(*) FROM games WHERE created_at >= ? AND created_at < ?) < 400`,
    )
    .bind(
      input.id,
      input.ownerHash,
      input.ipHash,
      input.role,
      JSON.stringify(input.state),
      input.now,
      input.now + GAME_TTL_MS,
      input.ownerHash,
      dayStart,
      dayEnd,
      dayStart,
      dayEnd,
    )
    .run();
  if (result.meta.changes !== 0 && result.meta.changes !== 1) throw new Error("Unexpected game creation change count");
  return result.meta.changes === 1;
}

export async function claimGame(
  db: D1Database,
  input: { id: string; ownerHash: string; version: number; token: string; now: number },
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE games
          SET processing_token = ?, processing_until = ?
        WHERE id = ? AND owner_hash = ? AND version = ? AND expires_at > ?
          AND (processing_until IS NULL OR processing_until <= ?)`,
    )
    .bind(input.token, input.now + 30_000, input.id, input.ownerHash, input.version, input.now, input.now)
    .run();
  if (result.meta.changes !== 0 && result.meta.changes !== 1) throw new Error("Unexpected game claim change count");
  return result.meta.changes === 1;
}

export async function releaseGame(db: D1Database, id: string, token: string): Promise<void> {
  const result = await db
    .prepare("UPDATE games SET processing_token = NULL, processing_until = NULL WHERE id = ? AND processing_token = ?")
    .bind(id, token)
    .run();
  if (result.meta.changes !== 0 && result.meta.changes !== 1) throw new Error("Unexpected game release change count");
}

export async function saveGame(
  db: D1Database,
  input: { id: string; ownerHash: string; version: number; token: string; state: GameState; now: number },
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE games
          SET state_json = ?, version = version + 1, processing_token = NULL, processing_until = NULL
        WHERE id = ? AND owner_hash = ? AND version = ? AND processing_token = ?
          AND processing_until > ? AND expires_at > ?`,
    )
    .bind(JSON.stringify(input.state), input.id, input.ownerHash, input.version, input.token, input.now, input.now)
    .run();
  if (result.meta.changes !== 0 && result.meta.changes !== 1) throw new Error("Unexpected game save change count");
  return result.meta.changes === 1;
}

export async function cleanup(db: D1Database, now: number): Promise<void> {
  await db.batch([
    db
      .prepare("DELETE FROM games WHERE expires_at <= ? AND (processing_until IS NULL OR processing_until <= ?)")
      .bind(now, now),
    db.prepare("DELETE FROM ai_attempts WHERE created_at < ?").bind(now - ATTEMPT_RETENTION_MS),
  ]);
}

type Reservation =
  | { allowed: true }
  | { allowed: false; code: "DAILY_LIMIT_REACHED" | "SESSION_LIMIT" | "IP_LIMIT"; retryAt: number };
type LimitCode = "DAILY_LIMIT_REACHED" | "SESSION_LIMIT" | "IP_LIMIT";

type QuotaCounts = {
  global_day: number;
  owner_day: number;
  ip_day: number;
  owner_session: number;
  ip_session: number;
  owner_first: number | null;
  ip_first: number | null;
};

export async function reserveAiAttempt(
  db: D1Database,
  input: { id: string; gameId: string; ownerHash: string; ipHash: string; now: number },
): Promise<Reservation> {
  const day = istDay(input.now);
  const rollingStart = input.now - MINUTE_MS;
  const result = await db
    .prepare(
      `INSERT INTO ai_attempts (id, game_id, owner_hash, ip_hash, ist_day, created_at)
       SELECT ?, ?, ?, ?, ?, ?
        WHERE (SELECT COUNT(*) FROM ai_attempts WHERE ist_day = ?) < 1000
          AND (SELECT COUNT(*) FROM ai_attempts WHERE owner_hash = ? AND ist_day = ?) < 50
          AND (SELECT COUNT(*) FROM ai_attempts WHERE ip_hash = ? AND ist_day = ?) < 500
          AND (SELECT COUNT(*) FROM ai_attempts WHERE owner_hash = ? AND created_at > ?) < 6
          AND (SELECT COUNT(*) FROM ai_attempts WHERE ip_hash = ? AND created_at > ?) < 60`,
    )
    .bind(
      input.id,
      input.gameId,
      input.ownerHash,
      input.ipHash,
      day,
      input.now,
      day,
      input.ownerHash,
      day,
      input.ipHash,
      day,
      input.ownerHash,
      rollingStart,
      input.ipHash,
      rollingStart,
    )
    .run();
  if (result.meta.changes === 1) return { allowed: true };
  if (result.meta.changes !== 0) throw new Error("Unexpected AI reservation change count");

  const primary = db.withSession("first-primary");
  const counts = await primary
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM ai_attempts WHERE ist_day = ?) AS global_day,
        (SELECT COUNT(*) FROM ai_attempts WHERE owner_hash = ? AND ist_day = ?) AS owner_day,
        (SELECT COUNT(*) FROM ai_attempts WHERE ip_hash = ? AND ist_day = ?) AS ip_day,
        (SELECT COUNT(*) FROM ai_attempts WHERE owner_hash = ? AND created_at > ?) AS owner_session,
        (SELECT COUNT(*) FROM ai_attempts WHERE ip_hash = ? AND created_at > ?) AS ip_session,
        (SELECT MIN(created_at) FROM ai_attempts WHERE owner_hash = ? AND created_at > ?) AS owner_first,
        (SELECT MIN(created_at) FROM ai_attempts WHERE ip_hash = ? AND created_at > ?) AS ip_first`,
    )
    .bind(
      day,
      input.ownerHash,
      day,
      input.ipHash,
      day,
      input.ownerHash,
      rollingStart,
      input.ipHash,
      rollingStart,
      input.ownerHash,
      rollingStart,
      input.ipHash,
      rollingStart,
    )
    .first<QuotaCounts>();
  if (!counts) throw new Error("AI quota counts unavailable");

  const blockers: Array<{ code: LimitCode; retryAt: number }> = [];
  if (Number(counts.global_day) >= 1000 || Number(counts.owner_day) >= 50) {
    blockers.push({ code: "DAILY_LIMIT_REACHED", retryAt: nextIstMidnight(input.now) });
  }
  if (Number(counts.ip_day) >= 500) {
    blockers.push({ code: "IP_LIMIT", retryAt: nextIstMidnight(input.now) });
  }
  if (Number(counts.owner_session) >= 6 && counts.owner_first !== null) {
    blockers.push({ code: "SESSION_LIMIT", retryAt: Number(counts.owner_first) + MINUTE_MS });
  }
  if (Number(counts.ip_session) >= 60 && counts.ip_first !== null) {
    blockers.push({ code: "IP_LIMIT", retryAt: Number(counts.ip_first) + MINUTE_MS });
  }
  if (blockers.length === 0) throw new Error("AI reservation failed without a quota blocker");

  const blocker = blockers.reduce((current, candidate) => (candidate.retryAt > current.retryAt ? candidate : current));
  return { allowed: false, code: blocker.code, retryAt: blocker.retryAt };
}
