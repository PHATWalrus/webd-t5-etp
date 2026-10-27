import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { initialState } from "../src/lib/game/rules";
import {
  cleanup,
  claimGame,
  createGame,
  getGame,
  istDay,
  nextIstMidnight,
  releaseGame,
  reserveAiAttempt,
  saveGame,
} from "../src/lib/server/storage";
import { countRows, createTestD1, insertAttempts } from "./helpers/d1";

const dayMs = 86_400_000;
const minuteMs = 60_000;
const gameInput = (now: number, id = crypto.randomUUID(), ownerHash = "owner") => ({
  id,
  ownerHash,
  ipHash: "ip",
  role: "innocent" as const,
  state: initialState(),
  now,
});

describe("D1 storage", () => {
  test("creates, reads, expires, claims, saves, and releases games with CAS leases", async () => {
    const { db, close } = await createTestD1();
    try {
      const now = Date.UTC(2026, 9, 27, 10);
      expect(await createGame(db, gameInput(now, "game-1"))).toBe(true);
      expect(await getGame(db, "game-1", "owner", now)).toMatchObject({ id: "game-1", version: 0 });
      expect(await getGame(db, "game-1", "other", now)).toBeNull();
      expect(await getGame(db, "game-1", "owner", now + 7 * dayMs)).toBeNull();

      expect(await claimGame(db, { id: "game-1", ownerHash: "owner", version: 0, token: "token-1", now })).toBe(true);
      expect(await claimGame(db, { id: "game-1", ownerHash: "owner", version: 0, token: "token-2", now: now + 1 })).toBe(false);
      expect(await saveGame(db, { id: "game-1", ownerHash: "owner", version: 0, token: "wrong", state: initialState(), now: now + 1 })).toBe(false);
      expect(await saveGame(db, { id: "game-1", ownerHash: "owner", version: 0, token: "token-1", state: initialState(), now: now + 1 })).toBe(true);
      expect(await getGame(db, "game-1", "owner", now + 1)).toMatchObject({ version: 1, processing_token: null });
      await releaseGame(db, "game-1", "token-1");
    } finally {
      close();
    }
  });

  test("rejects stale saves after a lease expires", async () => {
    const { db, close } = await createTestD1();
    try {
      const now = Date.UTC(2026, 9, 27, 10);
      await createGame(db, gameInput(now, "late"));
      expect(await claimGame(db, { id: "late", ownerHash: "owner", version: 0, token: "lease", now })).toBe(true);
      expect(await saveGame(db, { id: "late", ownerHash: "owner", version: 0, token: "lease", state: initialState(), now: now + 30_001 })).toBe(false);
      expect(await claimGame(db, { id: "late", ownerHash: "owner", version: 0, token: "new-lease", now: now + 30_001 })).toBe(true);
      await releaseGame(db, "late", "lease");
      expect(await getGame(db, "late", "owner", now + 30_001)).toMatchObject({ processing_token: "new-lease" });
    } finally {
      close();
    }
  });

  test("enforces per-owner and global game creation caps atomically", async () => {
    const { db, close } = await createTestD1();
    try {
      const now = Date.UTC(2026, 9, 27, 10);
      for (let i = 0; i < 10; i += 1) expect(await createGame(db, gameInput(now, `owner-${i}`))).toBe(true);
      expect(await createGame(db, gameInput(now, "owner-over"))).toBe(false);

      for (let i = 10; i < 400; i += 1) expect(await createGame(db, gameInput(now, `owner-${i}`, `owner-${i}`))).toBe(true);
      expect(await createGame(db, gameInput(now, "global-over"))).toBe(false);
      expect(await createGame(db, gameInput(now + dayMs, "global-next-day", "next-day-owner"))).toBe(true);
    } finally {
      close();
    }
  });

  test("uses IST calendar boundaries and preserves attempts across daily rollover", async () => {
    const { db, close } = await createTestD1();
    try {
      const beforeMidnight = Date.UTC(2026, 9, 27, 18, 29, 59, 999);
      const afterMidnight = beforeMidnight + 1;
      expect(istDay(beforeMidnight)).toBe("2026-10-27");
      expect(istDay(afterMidnight)).toBe("2026-10-28");
      expect(nextIstMidnight(beforeMidnight)).toBe(afterMidnight);

      await insertAttempts(
        db,
        Array.from({ length: 1_000 }, (_, i) => ({
          id: `daily-${i}`,
          gameId: "g",
          ownerHash: `o-${i}`,
          ipHash: `p-${i}`,
          istDay: istDay(beforeMidnight),
          createdAt: beforeMidnight - i,
        })),
      );
      expect(await reserveAiAttempt(db, { id: "new-day", gameId: "g", ownerHash: "owner", ipHash: "ip", now: afterMidnight })).toEqual({ allowed: true });
    } finally {
      close();
    }
  });

  test("counts rolling sessions across an IST midnight and reports the reset", async () => {
    const { db, close } = await createTestD1();
    try {
      const beforeMidnight = Date.UTC(2026, 9, 27, 18, 29, 59, 500);
      const now = beforeMidnight + 1_000;
      const owner = "rolling-owner";
      await insertAttempts(db, Array.from({ length: 6 }, (_, i) => ({
        id: `roll-${i}`,
        gameId: "g",
        ownerHash: owner,
        ipHash: `p-${i}`,
        istDay: istDay(beforeMidnight),
        createdAt: beforeMidnight - i,
      })));
      const result = await reserveAiAttempt(db, { id: "roll-new", gameId: "g", ownerHash: owner, ipHash: "new-ip", now });
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.code).toBe("SESSION_LIMIT");
        expect(result.retryAt).toBe(beforeMidnight - 5 + 60_000);
        expect(await reserveAiAttempt(db, { id: "roll-boundary", gameId: "g", ownerHash: owner, ipHash: "boundary-ip", now: result.retryAt })).toEqual({ allowed: true });
      }
    } finally {
      close();
    }
  });

  test("enforces owner and IP session/day caps", async () => {
    const { db, close } = await createTestD1();
    try {
      const now = Date.UTC(2026, 9, 27, 10);
      await insertAttempts(db, Array.from({ length: 6 }, (_, i) => ({ id: `s-${i}`, gameId: "g", ownerHash: "session", ipHash: `s-ip-${i}`, istDay: istDay(now), createdAt: now - 1 }))); 
      const sessionBlocked = await reserveAiAttempt(db, { id: "s-new", gameId: "g", ownerHash: "session", ipHash: "fresh", now });
      expect(sessionBlocked).toMatchObject({ allowed: false, code: "SESSION_LIMIT" });

      await insertAttempts(db, Array.from({ length: 60 }, (_, i) => ({ id: `ip-${i}`, gameId: "g", ownerHash: `ip-owner-${i}`, ipHash: "ip-cap", istDay: istDay(now), createdAt: now - 1 }))); 
      const ipBlocked = await reserveAiAttempt(db, { id: "ip-new", gameId: "g", ownerHash: "fresh-owner", ipHash: "ip-cap", now });
      expect(ipBlocked).toMatchObject({ allowed: false, code: "IP_LIMIT" });
    } finally {
      close();
    }
  });

  test("enforces owner and IP daily quotas independently of rolling quotas", async () => {
    const now = Date.UTC(2026, 9, 27, 10);
    const ownerDb = await createTestD1();
    try {
      await insertAttempts(ownerDb.db, Array.from({ length: 50 }, (_, i) => ({
        id: `owner-day-${i}`,
        gameId: "g",
        ownerHash: "owner-day",
        ipHash: `owner-day-ip-${i}`,
        istDay: istDay(now),
        createdAt: now - 2 * minuteMs,
      })));
      expect(await reserveAiAttempt(ownerDb.db, { id: "owner-day-new", gameId: "g", ownerHash: "owner-day", ipHash: "fresh", now })).toMatchObject({
        allowed: false,
        code: "DAILY_LIMIT_REACHED",
        retryAt: nextIstMidnight(now),
      });
    } finally {
      ownerDb.close();
    }

    const ipDb = await createTestD1();
    try {
      await insertAttempts(ipDb.db, Array.from({ length: 500 }, (_, i) => ({
        id: `ip-day-${i}`,
        gameId: "g",
        ownerHash: `ip-day-owner-${i}`,
        ipHash: "ip-day",
        istDay: istDay(now),
        createdAt: now - 2 * minuteMs,
      })));
      expect(await reserveAiAttempt(ipDb.db, { id: "ip-day-new", gameId: "g", ownerHash: "fresh", ipHash: "ip-day", now })).toMatchObject({
        allowed: false,
        code: "IP_LIMIT",
        retryAt: nextIstMidnight(now),
      });
    } finally {
      ipDb.close();
    }
  });

  test("reports the latest reset when owner and IP rolling limits both block", async () => {
    const { db, close } = await createTestD1();
    try {
      const now = Date.UTC(2026, 9, 27, 10);
      await insertAttempts(db, [
        ...Array.from({ length: 6 }, (_, i) => ({
          id: `max-owner-${i}`,
          gameId: "g",
          ownerHash: "max-owner",
          ipHash: `max-owner-ip-${i}`,
          istDay: istDay(now),
          createdAt: now - 59_000,
        })),
        ...Array.from({ length: 60 }, (_, i) => ({
          id: `max-ip-${i}`,
          gameId: "g",
          ownerHash: `max-ip-owner-${i}`,
          ipHash: "max-ip",
          istDay: istDay(now),
          createdAt: now - 30_000,
        })),
      ]);
      expect(await reserveAiAttempt(db, { id: "max-new", gameId: "g", ownerHash: "max-owner", ipHash: "max-ip", now })).toEqual({
        allowed: false,
        code: "IP_LIMIT",
        retryAt: now + 30_000,
      });
    } finally {
      close();
    }
  });

  test("admits only one of two concurrent reservations at global 999 and never refunds a failure", async () => {
    const { db, close } = await createTestD1();
    try {
      const now = Date.UTC(2026, 9, 27, 10);
      await insertAttempts(db, Array.from({ length: 999 }, (_, i) => ({ id: `global-${i}`, gameId: "g", ownerHash: `o-${i}`, ipHash: `p-${i}`, istDay: istDay(now), createdAt: now }))); 
      const results = await Promise.all([
        reserveAiAttempt(db, { id: "race-a", gameId: "g", ownerHash: "race-a", ipHash: "race-a", now }),
        reserveAiAttempt(db, { id: "race-b", gameId: "g", ownerHash: "race-b", ipHash: "race-b", now }),
      ]);
      expect(results.filter((result) => result.allowed)).toHaveLength(1);
      expect(await countRows(db, "ai_attempts")).toBe(1_000);

      const blocked = await reserveAiAttempt(db, { id: "after-limit", gameId: "g", ownerHash: "new-owner", ipHash: "new-ip", now });
      expect(blocked).toMatchObject({ allowed: false, code: "DAILY_LIMIT_REACHED" });
      expect(await countRows(db, "ai_attempts")).toBe(1_000);
    } finally {
      close();
    }
  });

  test("cleans expired unlocked games and old attempts while retaining active work", async () => {
    const { db, close } = await createTestD1();
    try {
      const now = Date.UTC(2026, 9, 27, 10);
      await db.prepare("INSERT INTO games VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(
          "expired", "o", "p", "innocent", JSON.stringify(initialState()), 0, null, null, now - 1, now - 1,
          "active", "o", "p", "innocent", JSON.stringify(initialState()), 0, "lease", now + 30_000, now - 1, now - 1,
        ).run();
      await insertAttempts(db, [
        { id: "old", gameId: "g", ownerHash: "o", ipHash: "p", istDay: istDay(now - 9 * dayMs), createdAt: now - 9 * dayMs },
        { id: "fresh", gameId: "g", ownerHash: "o", ipHash: "p", istDay: istDay(now), createdAt: now },
      ]);
      await cleanup(db, now);
      expect(await db.prepare("SELECT id FROM games ORDER BY id").raw()).toEqual([["active"]]);
      expect(await db.prepare("SELECT id FROM ai_attempts ORDER BY id").raw()).toEqual([["fresh"]]);
    } finally {
      close();
    }
  });

  test("persists rows after a D1 connection reopens", async () => {
    const path = join(mkdtempSync(join(tmpdir(), "alibi-d1-")), "db.sqlite");
    const first = await createTestD1(path);
    const now = Date.UTC(2026, 9, 27, 10);
    await createGame(first.db, gameInput(now, "persisted"));
    first.close();

    const second = await createTestD1(path);
    try {
      expect(await getGame(second.db, "persisted", "owner", now)).toMatchObject({ id: "persisted" });
    } finally {
      second.close();
    }
  });
});
