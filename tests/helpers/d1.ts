import { Database } from "bun:sqlite";
import type { D1Database, D1ExecResult, D1PreparedStatement, D1Result } from "@cloudflare/workers-types";

type BoundStatement = {
  sql: string;
  values: unknown[];
};

class BunPrepared {
  private readonly statement: BoundStatement;
  private readonly database: Database;

  constructor(database: Database, statement: BoundStatement) {
    this.database = database;
    this.statement = statement;
  }

  bind(...values: unknown[]): BunPrepared {
    return new BunPrepared(this.database, { sql: this.statement.sql, values });
  }

  async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
    const row = this.database.query(this.statement.sql).get(...(this.statement.values as any[])) as Record<string, unknown> | null;
    if (row === null) return null;
    return (colName === undefined ? row : row[colName]) as T;
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const rows = this.database.query(this.statement.sql).all(...(this.statement.values as any[])) as T[];
    return { success: true, results: rows, meta: this.meta(0, rows.length) };
  }

  async raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<T[]> {
    if (options?.columnNames) {
      const columns = this.database.query(this.statement.sql).columnNames;
      return [columns, ...this.database.query(this.statement.sql).values(...(this.statement.values as any[]))] as T[];
    }
    return this.database.query(this.statement.sql).values(...(this.statement.values as any[])) as T[];
  }

  async run(): Promise<D1Result<never>> {
    return this.runSync();
  }

  runSync(): D1Result<never> {
    const result = this.database.query(this.statement.sql).run(...(this.statement.values as any[]));
    return {
      success: true,
      results: [],
      meta: this.meta(result.changes, 0, Number(result.lastInsertRowid)),
    };
  }

  private meta(changes: number, rowsRead: number, lastRowId = 0): D1Result["meta"] {
    return {
      changes,
      last_row_id: Number(lastRowId),
      rows_read: rowsRead,
      rows_written: changes,
      changed_db: changes > 0,
      duration: 0,
      size_after: 0,
    };
  }
}

class BunD1 {
  constructor(readonly sqlite: Database) {}

  prepare(sql: string): D1PreparedStatement {
    return new BunPrepared(this.sqlite, { sql, values: [] }) as unknown as D1PreparedStatement;
  }

  async batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
    const run = this.sqlite.transaction(() => statements.map((statement) => (statement as unknown as BunPrepared).runSync()));
    return run();
  }

  withSession(): BunD1 {
    return this;
  }

  async exec(sql: string): Promise<D1ExecResult> {
    const result = this.sqlite.exec(sql);
    return { count: result.changes, duration: 0 };
  }

  close(): void {
    this.sqlite.close();
  }
}

export async function createTestD1(path = ":memory:"): Promise<{ db: D1Database; close: () => void }> {
  const sqlite = new Database(path);
  const facade = new BunD1(sqlite);
  await facade.exec(await Bun.file(new URL("../../migrations/0001_initial.sql", import.meta.url)).text());
  return { db: facade as unknown as D1Database, close: () => facade.close() };
}

export async function countRows(db: D1Database, table: "games" | "ai_attempts"): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).first<{ count: number }>();
  return Number(row?.count ?? 0);
}

export async function insertAttempts(
  db: D1Database,
  rows: Array<{ id: string; gameId: string; ownerHash: string; ipHash: string; istDay: string; createdAt: number }>,
): Promise<void> {
  for (const row of rows) {
    await db
      .prepare("INSERT INTO ai_attempts (id, game_id, owner_hash, ip_hash, ist_day, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(row.id, row.gameId, row.ownerHash, row.ipHash, row.istDay, row.createdAt)
      .run();
  }
}
