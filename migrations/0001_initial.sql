CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  owner_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('guilty', 'innocent')),
  state_json TEXT NOT NULL,
  version INTEGER NOT NULL,
  processing_token TEXT,
  processing_until INTEGER,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS games_owner_created_idx ON games (owner_hash, created_at);
CREATE INDEX IF NOT EXISTS games_created_idx ON games (created_at);
CREATE INDEX IF NOT EXISTS games_expiry_lock_idx ON games (expires_at, processing_until);

CREATE TABLE IF NOT EXISTS ai_attempts (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  owner_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  ist_day TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS ai_attempts_day_idx ON ai_attempts (ist_day);
CREATE INDEX IF NOT EXISTS ai_attempts_owner_day_idx ON ai_attempts (owner_hash, ist_day);
CREATE INDEX IF NOT EXISTS ai_attempts_ip_day_idx ON ai_attempts (ip_hash, ist_day);
CREATE INDEX IF NOT EXISTS ai_attempts_owner_created_idx ON ai_attempts (owner_hash, created_at);
CREATE INDEX IF NOT EXISTS ai_attempts_ip_created_idx ON ai_attempts (ip_hash, created_at);
CREATE INDEX IF NOT EXISTS ai_attempts_created_idx ON ai_attempts (created_at);
