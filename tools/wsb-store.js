import Database from 'better-sqlite3';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

const DEFAULT_CONFIG = {
  subreddits: ['wallstreetbets'],
  updateFrequency: '4h',
};

export function createStore(dbPath, configPath) {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  if (!configPath) {
    configPath = join(dirname(dbPath), 'config.json');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT (datetime('now')),
      subreddits TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ticker_mentions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_id INTEGER NOT NULL REFERENCES snapshots(id),
      ticker TEXT NOT NULL,
      mention_count INTEGER NOT NULL DEFAULT 0,
      post_count INTEGER NOT NULL DEFAULT 0,
      avg_score REAL DEFAULT 0,
      avg_upvote_ratio REAL DEFAULT 0,
      sentiment_score REAL DEFAULT 0,
      top_post_url TEXT,
      subreddit TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS anomaly_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT (datetime('now')),
      ticker TEXT NOT NULL,
      anomaly_type TEXT NOT NULL,
      details TEXT,
      notified INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_mentions_snapshot ON ticker_mentions(snapshot_id);
    CREATE INDEX IF NOT EXISTS idx_mentions_ticker ON ticker_mentions(ticker);
    CREATE INDEX IF NOT EXISTS idx_anomaly_ticker ON anomaly_log(ticker);
  `);

  return {
    _db: db,

    getConfig() {
      if (!existsSync(configPath)) return { ...DEFAULT_CONFIG };
      return JSON.parse(readFileSync(configPath, 'utf-8'));
    },

    saveConfig(config) {
      mkdirSync(dirname(configPath), { recursive: true });
      writeFileSync(configPath, JSON.stringify(config, null, 2));
    },

    listTables() {
      return db.prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all()
        .map(r => r.name);
    },

    insertSnapshot(subreddits) {
      const stmt = db.prepare('INSERT INTO snapshots (subreddits) VALUES (?)');
      const result = stmt.run(JSON.stringify(subreddits));
      return result.lastInsertRowid;
    },

    getRecentSnapshots(limit) {
      return db.prepare('SELECT * FROM snapshots ORDER BY timestamp DESC LIMIT ?').all(limit);
    },

    insertMention(m) {
      const stmt = db.prepare(`
        INSERT INTO ticker_mentions (snapshot_id, ticker, mention_count, post_count, avg_score, avg_upvote_ratio, sentiment_score, top_post_url, subreddit)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(m.snapshot_id, m.ticker, m.mention_count, m.post_count, m.avg_score, m.avg_upvote_ratio, m.sentiment_score, m.top_post_url, m.subreddit);
    },

    getMentionsForSnapshot(snapshotId) {
      return db.prepare('SELECT * FROM ticker_mentions WHERE snapshot_id = ?').all(snapshotId);
    },

    getTickerHistory(ticker, limit) {
      return db.prepare(`
        SELECT tm.*, s.timestamp FROM ticker_mentions tm
        JOIN snapshots s ON s.id = tm.snapshot_id
        WHERE tm.ticker = ?
        ORDER BY s.timestamp DESC
        LIMIT ?
      `).all(ticker, limit);
    },

    insertAnomaly(a) {
      const stmt = db.prepare('INSERT INTO anomaly_log (ticker, anomaly_type, details) VALUES (?, ?, ?)');
      return stmt.run(a.ticker, a.anomaly_type, a.details).lastInsertRowid;
    },

    getRecentAnomalies(limit) {
      return db.prepare('SELECT * FROM anomaly_log ORDER BY timestamp DESC LIMIT ?').all(limit);
    },

    markNotified(id) {
      db.prepare('UPDATE anomaly_log SET notified = 1 WHERE id = ?').run(id);
    },

    prune(retentionDays) {
      const cutoff = `datetime('now', '-${retentionDays} days')`;
      db.exec(`DELETE FROM ticker_mentions WHERE snapshot_id IN (SELECT id FROM snapshots WHERE timestamp < ${cutoff})`);
      db.exec(`DELETE FROM snapshots WHERE timestamp < ${cutoff}`);
      db.exec(`DELETE FROM anomaly_log WHERE timestamp < ${cutoff}`);
    },

    close() {
      db.close();
    },
  };
}
