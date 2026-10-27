import { describe, expect, test } from "bun:test";

import type { D1Database, RateLimit } from "@cloudflare/workers-types";

import { handleCreateGame, handleCreateTurn, handleGetGame, type ApiEnvironment } from "../src/lib/server/api";
import { claimGame, istDay } from "../src/lib/server/storage";
import { countRows, createTestD1, insertAttempts } from "./helpers/d1";

const origin = "http://localhost:3000";

function limiter(success = true): RateLimit {
  return { limit: async () => ({ success }) } as RateLimit;
}

function environment(db: D1Database, overrides: Partial<ApiEnvironment> = {}): ApiEnvironment {
  return {
    DB: db,
    API_LIMITER: limiter(),
    START_LIMITER: limiter(),
    APP_ORIGIN: origin,
    RATE_LIMIT_SALT: "test-salt",
    TYPESAFE_API_KEY: "test-key",
    AI_ENABLED: "true",
    ...overrides,
  };
}

function request(path: string, init: RequestInit = {}, ip = "198.51.100.10"): Request {
  const headers = new Headers(init.headers);
  if (init.method === "POST" && !headers.has("origin")) headers.set("origin", origin);
  const result = new Request(`${origin}${path}`, { ...init, headers });
  Object.defineProperty(result, "cf", { value: { connectingIP: ip } });
  return result;
}

function jsonRequest(path: string, body: unknown, cookie?: string): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (cookie) headers.set("cookie", cookie);
  return request(path, { method: "POST", headers, body: JSON.stringify(body) });
}

async function body<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

describe("server API", () => {
  test("creates an owned case and returns it without cacheable responses", async () => {
    const { db, close } = await createTestD1();
    try {
      const response = await handleCreateGame(jsonRequest("/api/games", { role: "innocent" }), environment(db), {
        now: () => 1_700_000_000_000,
        randomUUID: () => "game-1",
        ownerToken: () => "owner-token",
      });
      expect(response.status).toBe(201);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("set-cookie")).toContain("HttpOnly");
      expect(response.headers.get("set-cookie")).toContain("SameSite=Strict");
      const view = await body<{ id: string; role: string; status: string }>(response);
      expect(view).toMatchObject({ id: "game-1", role: "innocent", status: "playing" });
    } finally {
      close();
    }
  });

  test("rejects cross-origin, oversized, and ownerless requests", async () => {
    const { db, close } = await createTestD1();
    try {
      const env = environment(db);
      const crossOrigin = request("/api/games", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://evil.example" },
        body: JSON.stringify({ role: "innocent" }),
      });
      expect((await handleCreateGame(crossOrigin, env)).status).toBe(403);

      const oversized = jsonRequest("/api/games", { role: "innocent", padding: "x".repeat(9_000) });
      expect((await handleCreateGame(oversized, env)).status).toBe(413);
      expect((await handleGetGame(request("/api/games/game-1"), "game-1", env)).status).toBe(404);
    } finally {
      close();
    }
  });

  test("does not call Jev for a disabled preview or a held lease", async () => {
    const { db, close } = await createTestD1();
    try {
      const now = 1_700_000_000_000;
      const env = environment(db, { AI_ENABLED: "false" });
      const created = await handleCreateGame(jsonRequest("/api/games", { role: "innocent" }), env, {
        now: () => now,
        randomUUID: () => "game-1",
        ownerToken: () => "owner-token",
      });
      const cookieHeader = created.headers.get("set-cookie")?.split(";", 1)[0];
      if (!cookieHeader) throw new Error("create response did not set an owner cookie");
      const cookie = cookieHeader;
      const disabled = await handleCreateTurn(
        jsonRequest("/api/games/game-1/turns", { round: 1, statement: "I was at the booth." }, cookie),
        "game-1",
        env,
        { now: () => now },
      );
      expect(disabled.status).toBe(503);
    } finally {
      close();
    }
  });

  test("returns an identical duplicate without a second AI charge or fetch", async () => {
    const { db, close } = await createTestD1();
    try {
      let calls = 0;
      const env = environment(db);
      const created = await handleCreateGame(jsonRequest("/api/games", { role: "innocent" }), env, {
        now: () => 1_700_000_000_000,
        randomUUID: () => "game-1",
        ownerToken: () => "owner-token",
      });
      const cookie = created.headers.get("set-cookie")?.split(";", 1)[0];
      const fetch = async () => {
        calls += 1;
        return new Response(JSON.stringify({ answers: { reaction: { choice: "accept", confidence: 0.9 } } }), {
          headers: { "content-type": "application/json" },
        });
      };
      const deps = { now: () => 1_700_000_000_000, fetch, randomUUID: () => "attempt-1" };
      const first = await handleCreateTurn(
        jsonRequest("/api/games/game-1/turns", { round: 1, statement: "  I was at the booth.  " }, cookie),
        "game-1",
        env,
        deps,
      );
      const duplicate = await handleCreateTurn(
        jsonRequest("/api/games/game-1/turns", { round: 1, statement: "I was at the booth." }, cookie),
        "game-1",
        env,
        deps,
      );
      expect(first.status).toBe(200);
      expect(duplicate.status).toBe(200);
      expect(calls).toBe(1);
      expect(await body<{ turns: unknown[] }>(duplicate)).toMatchObject({ turns: [{ round: 1 }] });
    } finally {
      close();
    }
  });

  test("rejects a changed stale round after the first turn", async () => {
    const { db, close } = await createTestD1();
    try {
      const env = environment(db);
      const now = 1_700_000_000_000;
      const created = await handleCreateGame(jsonRequest("/api/games", { role: "innocent" }), env, {
        now: () => now,
        randomUUID: () => "game-1",
        ownerToken: () => "owner-token",
      });
      const cookie = created.headers.get("set-cookie")?.split(";", 1)[0];
      const fetch = async () => new Response(JSON.stringify({ answers: { reaction: { choice: "accept", confidence: 0.9 } } }));
      await handleCreateTurn(jsonRequest("/api/games/game-1/turns", { round: 1, statement: "At the booth." }, cookie), "game-1", env, {
        now: () => now,
        fetch,
        randomUUID: () => "attempt-1",
      });
      const stale = await handleCreateTurn(jsonRequest("/api/games/game-1/turns", { round: 1, statement: "Elsewhere." }, cookie), "game-1", env, {
        now: () => now,
        fetch,
        randomUUID: () => "attempt-2",
      });
      expect(stale.status).toBe(409);
      expect(await body<{ round: number }>(stale)).toMatchObject({ round: 1 });
    } finally {
      close();
    }
  });

  test("reports a held lease as a concurrency conflict without fetching", async () => {
    const { db, close } = await createTestD1();
    try {
      const now = 1_700_000_000_000;
      const env = environment(db);
      const created = await handleCreateGame(jsonRequest("/api/games", { role: "innocent" }), env, {
        now: () => now,
        randomUUID: () => "game-1",
        ownerToken: () => "owner-token",
      });
      const cookie = created.headers.get("set-cookie")?.split(";", 1)[0];
      const row = await db.prepare("SELECT * FROM games WHERE id = ?").bind("game-1").first<{ owner_hash: string; version: number }>();
      expect(row).not.toBeNull();
      await claimGame(db, { id: "game-1", ownerHash: row!.owner_hash, version: row!.version, token: "held", now });
      let calls = 0;
      const result = await handleCreateTurn(jsonRequest("/api/games/game-1/turns", { round: 1, statement: "At the booth." }, cookie), "game-1", env, {
        now: () => now,
        fetch: async () => {
          calls += 1;
          throw new Error("must not fetch");
        },
        randomUUID: () => "other-token",
      });
      expect(result.status).toBe(409);
      expect(calls).toBe(0);
    } finally {
      close();
    }
  });

  test("applies both coarse limiters and does not bypass the API limiter without a cookie", async () => {
    const { db, close } = await createTestD1();
    try {
      let apiCalls = 0;
      let startCalls = 0;
      const env = environment(db, {
        API_LIMITER: { limit: async () => (apiCalls++, { success: true }) } as RateLimit,
        START_LIMITER: { limit: async () => (startCalls++, { success: true }) } as RateLimit,
      });
      const created = await handleCreateGame(jsonRequest("/api/games", { role: "innocent" }), env, {
        now: () => 1_700_000_000_000,
        randomUUID: () => "game-1",
        ownerToken: () => "owner-token",
      });
      expect(created.status).toBe(201);
      expect(apiCalls).toBe(1);
      expect(startCalls).toBe(1);
      expect((await handleGetGame(request("/api/games/game-1"), "game-1", env)).status).toBe(404);
      expect(apiCalls).toBe(2);
    } finally {
      close();
    }
  });

  test("streams request bodies with an 8 KiB cap and uses the production CF IP header", async () => {
    const { db, close } = await createTestD1();
    try {
      const env = environment(db, { APP_ORIGIN: "https://alibi.example" });
      const oversized = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"role":"innocent","padding":"'));
          controller.enqueue(new TextEncoder().encode("x".repeat(8_200)));
          controller.enqueue(new TextEncoder().encode('"}'));
          controller.close();
        },
      });
      const tooLarge = new Request("https://alibi.example/api/games", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://alibi.example", "CF-Connecting-IP": "203.0.113.5" },
        body: oversized,
      });
      expect((await handleCreateGame(tooLarge, env)).status).toBe(413);

      const valid = new Request("https://alibi.example/api/games", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://alibi.example", "CF-Connecting-IP": "203.0.113.5" },
        body: JSON.stringify({ role: "innocent" }),
      });
      const response = await handleCreateGame(valid, env, {
        now: () => 1_700_000_000_000,
        randomUUID: () => "game-1",
        ownerToken: () => "owner-token",
      });
      expect(response.status).toBe(201);
      expect(response.headers.get("set-cookie")).toContain("Secure");
    } finally {
      close();
    }
  });

  test("reserves quota before Jev, preserves failed state, and releases its lease", async () => {
    const { db, close } = await createTestD1();
    try {
      const now = 1_700_000_000_000;
      const env = environment(db);
      const created = await handleCreateGame(jsonRequest("/api/games", { role: "innocent" }), env, {
        now: () => now,
        randomUUID: () => "game-1",
        ownerToken: () => "owner-token",
      });
      const cookie = created.headers.get("set-cookie")?.split(";", 1)[0];
      let calls = 0;
      const failed = await handleCreateTurn(
        jsonRequest("/api/games/game-1/turns", { round: 1, statement: "At the booth." }, cookie),
        "game-1",
        env,
        {
          now: () => now,
          randomUUID: () => "attempt-1",
          fetch: async () => {
            calls += 1;
            return new Response("provider failed", { status: 503 });
          },
        },
      );
      expect(failed.status).toBe(502);
      expect(calls).toBe(1);
      expect(await countRows(db, "ai_attempts")).toBe(1);
      const row = await db.prepare("SELECT state_json, version, processing_token FROM games WHERE id = ?").bind("game-1").first<{ state_json: string; version: number; processing_token: string | null }>();
      expect(row?.version).toBe(0);
      expect(row?.processing_token).toBeNull();
      expect(JSON.parse(row?.state_json ?? "{}").turns).toEqual([]);
    } finally {
      close();
    }
  });

  test("returns quota errors before a provider call and reports its reset", async () => {
    const { db, close } = await createTestD1();
    try {
      const now = 1_700_000_000_000;
      const env = environment(db);
      const created = await handleCreateGame(jsonRequest("/api/games", { role: "innocent" }), env, {
        now: () => now,
        randomUUID: () => "game-1",
        ownerToken: () => "owner-token",
      });
      const cookie = created.headers.get("set-cookie")?.split(";", 1)[0];
      await insertAttempts(db, Array.from({ length: 1_000 }, (_, i) => ({
        id: `quota-${i}`,
        gameId: "other",
        ownerHash: `owner-${i}`,
        ipHash: `ip-${i}`,
        istDay: istDay(now),
        createdAt: now,
      })));
      let calls = 0;
      const response = await handleCreateTurn(jsonRequest("/api/games/game-1/turns", { round: 1, statement: "At the booth." }, cookie), "game-1", env, {
        now: () => now,
        randomUUID: () => "attempt-1",
        fetch: async () => {
          calls += 1;
          throw new Error("must not fetch");
        },
      });
      expect(response.status).toBe(429);
      expect(response.headers.get("retry-after")).toBeTruthy();
      expect((await body<{ error: { retryAt: string }; round: number }>(response)).round).toBe(1);
      expect(calls).toBe(0);
      expect(await countRows(db, "ai_attempts")).toBe(1_000);
    } finally {
      close();
    }
  });

  test("does not call Jev when database access is ambiguous", async () => {
    const { db, close } = await createTestD1();
    try {
      const now = 1_700_000_000_000;
      const env = environment(db);
      const created = await handleCreateGame(jsonRequest("/api/games", { role: "innocent" }), env, {
        now: () => now,
        randomUUID: () => "game-1",
        ownerToken: () => "owner-token",
      });
      const cookie = created.headers.get("set-cookie")?.split(";", 1)[0];
      const brokenEnv = { ...env, DB: { prepare: () => { throw new Error("ambiguous database"); } } as unknown as D1Database };
      let calls = 0;
      const response = await handleCreateTurn(jsonRequest("/api/games/game-1/turns", { round: 1, statement: "At the booth." }, cookie), "game-1", brokenEnv, {
        now: () => now,
        fetch: async () => {
          calls += 1;
          throw new Error("must not fetch");
        },
      });
      expect(response.status).toBe(503);
      expect(calls).toBe(0);
    } finally {
      close();
    }
  });

  test("accepts an identical statement after completion without another reservation", async () => {
    const { db, close } = await createTestD1();
    try {
      const now = 1_700_000_000_000;
      const env = environment(db);
      const created = await handleCreateGame(jsonRequest("/api/games", { role: "innocent" }), env, {
        now: () => now,
        ownerToken: () => "owner-token",
        randomUUID: () => "game-1",
      });
      const cookie = created.headers.get("set-cookie")?.split(";", 1)[0];
      let calls = 0;
      const fetch = async () => {
        calls += 1;
        return new Response(JSON.stringify({ answers: { reaction: { choice: "accept", confidence: 0.9 } } }));
      };
      const ids = (() => {
        let n = 100;
        return () => `attempt-${n++}`;
      })();
      for (let round = 1; round <= 5; round += 1) {
        const response = await handleCreateTurn(jsonRequest("/api/games/game-1/turns", { round, statement: `Statement ${round}.` }, cookie), "game-1", env, {
          now: () => now,
          fetch,
          randomUUID: ids,
        });
        expect(response.status).toBe(200);
      }
      const before = calls;
      const duplicate = await handleCreateTurn(jsonRequest("/api/games/game-1/turns", { round: 1, statement: "Statement 1." }, cookie), "game-1", env, {
        now: () => now,
        fetch,
        randomUUID: ids,
      });
      expect(duplicate.status).toBe(200);
      expect((await body<{ status: string; turns: unknown[] }>(duplicate)).status).toBe("finished");
      expect(calls).toBe(before);
      expect(await countRows(db, "ai_attempts")).toBe(5);
    } finally {
      close();
    }
  });

  test("hides cases from the wrong owner and after expiry", async () => {
    const { db, close } = await createTestD1();
    try {
      const now = 1_700_000_000_000;
      const env = environment(db);
      const created = await handleCreateGame(jsonRequest("/api/games", { role: "innocent" }), env, {
        now: () => now,
        randomUUID: () => "game-1",
        ownerToken: () => "owner-token",
      });
      const cookieHeader = created.headers.get("set-cookie")?.split(";", 1)[0];
      if (!cookieHeader) throw new Error("create response did not set an owner cookie");
      const cookie = cookieHeader;
      expect((await handleGetGame(request("/api/games/game-1", { headers: { cookie: "alibi_owner=other" } }), "game-1", env, { now: () => now })).status).toBe(404);
      expect((await handleGetGame(request("/api/games/game-1", { headers: { cookie } }), "game-1", env, { now: () => now + 7 * 86_400_000 + 1 })).status).toBe(404);
    } finally {
      close();
    }
  });
});


test("persists each selected case and sends only its revealed public evidence to Jev", async () => {
  const { db, close } = await createTestD1();
  try {
    const env = environment(db);
    for (const caseId of ["fest-fund", "exam-leak", "missing-trophy"]) {
      const created = await handleCreateGame(jsonRequest("/api/games", { role: "innocent", caseId }), env);
      expect(created.status).toBe(201);
      const cookie = created.headers.get("set-cookie")!.split(";")[0];
      const view = await created.json() as { id: string; caseId: string; briefing: string; caseTitle: string };
      expect(view.caseId).toBe(caseId);
      const resumed = await handleGetGame(request(`/api/games/${view.id}`, { headers: { cookie } }), view.id, env);
      expect(await resumed.json()).toMatchObject({ caseId, briefing: view.briefing });
      let payload: any;
      const response = await handleCreateTurn(
        jsonRequest(`/api/games/${view.id}/turns`, { round: 1, statement: "I was completing an authorized equipment errand in that area." }, cookie),
        view.id, env, { fetch: async (_url, init) => {
          payload = JSON.parse(String(init?.body));
          return new Response(JSON.stringify({ answers: { reaction: { choice: "accept", confidence: 0.95 } } }));
        } },
      );
      expect(response.status).toBe(200);
      expect(payload.state.caseTitle).toBe(view.caseTitle);
      expect(payload.state.revealedEvidence).toHaveLength(1);
      expect(payload.state).not.toHaveProperty("role");
      expect(payload.state).not.toHaveProperty("briefing");
      expect(JSON.stringify(payload)).not.toContain(view.briefing);
    }
    const invalid = await handleCreateGame(jsonRequest("/api/games", { role: "innocent", caseId: "not-a-case" }), env);
    expect(invalid.status).toBe(400);
  } finally { close(); }
});
