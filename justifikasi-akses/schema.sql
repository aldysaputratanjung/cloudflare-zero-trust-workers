CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user TEXT NOT NULL,
  host TEXT NOT NULL,
  reason TEXT NOT NULL,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_user_ts ON audit (user, ts);
CREATE INDEX IF NOT EXISTS idx_audit_host_ts ON audit (host, ts);
