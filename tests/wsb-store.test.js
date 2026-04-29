import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createStore } from '../tools/wsb-store.js';
import { unlinkSync, existsSync } from 'fs';

const TEST_DB = '/tmp/wsb-test.db';
const TEST_CONFIG = '/tmp/wsb-test-config.json';

function db_raw(store) {
  return store._db;
}

describe('WsbStore', () => {
  let store;

  beforeEach(() => {
    store = createStore(TEST_DB, TEST_CONFIG);
  });

  afterEach(() => {
    store.close();
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
    if (existsSync(TEST_CONFIG)) unlinkSync(TEST_CONFIG);
  });

  describe('initialization', () => {
    it('creates tables on init', () => {
      const tables = store.listTables();
      expect(tables).toContain('snapshots');
      expect(tables).toContain('ticker_mentions');
      expect(tables).toContain('anomaly_log');
    });
  });

  describe('config', () => {
    it('returns default config when none exists', () => {
      const config = store.getConfig();
      expect(config.subreddits).toEqual(['wallstreetbets']);
      expect(config.updateFrequency).toBe('4h');
    });

    it('saves and loads config', () => {
      store.saveConfig({ subreddits: ['wallstreetbets', 'stocks'], updateFrequency: '2h' });
      const config = store.getConfig();
      expect(config.subreddits).toEqual(['wallstreetbets', 'stocks']);
      expect(config.updateFrequency).toBe('2h');
    });
  });

  describe('snapshots', () => {
    it('inserts a snapshot and returns its id', () => {
      const id = store.insertSnapshot(['wallstreetbets']);
      expect(id).toBe(1);
    });

    it('retrieves recent snapshots', () => {
      store.insertSnapshot(['wallstreetbets']);
      store.insertSnapshot(['wallstreetbets', 'stocks']);
      const snaps = store.getRecentSnapshots(5);
      expect(snaps).toHaveLength(2);
      expect(JSON.parse(snaps[0].subreddits)).toContain('wallstreetbets');
    });
  });

  describe('ticker mentions', () => {
    it('inserts and retrieves mentions for a snapshot', () => {
      const snapId = store.insertSnapshot(['wallstreetbets']);
      store.insertMention({
        snapshot_id: snapId,
        ticker: 'GME',
        mention_count: 150,
        post_count: 30,
        avg_score: 245.5,
        avg_upvote_ratio: 0.92,
        sentiment_score: 0.7,
        top_post_url: 'https://reddit.com/r/wallstreetbets/123',
        subreddit: 'wallstreetbets',
      });
      const mentions = store.getMentionsForSnapshot(snapId);
      expect(mentions).toHaveLength(1);
      expect(mentions[0].ticker).toBe('GME');
      expect(mentions[0].mention_count).toBe(150);
    });

    it('retrieves historical mentions for a ticker', () => {
      const s1 = store.insertSnapshot(['wallstreetbets']);
      const s2 = store.insertSnapshot(['wallstreetbets']);
      store.insertMention({ snapshot_id: s1, ticker: 'GME', mention_count: 50, post_count: 10, avg_score: 100, avg_upvote_ratio: 0.9, sentiment_score: 0.3, top_post_url: '', subreddit: 'wallstreetbets' });
      store.insertMention({ snapshot_id: s2, ticker: 'GME', mention_count: 200, post_count: 40, avg_score: 300, avg_upvote_ratio: 0.95, sentiment_score: 0.8, top_post_url: '', subreddit: 'wallstreetbets' });
      const history = store.getTickerHistory('GME', 5);
      expect(history).toHaveLength(2);
    });
  });

  describe('anomaly log', () => {
    it('inserts and retrieves anomalies', () => {
      store.insertAnomaly({
        ticker: 'GME',
        anomaly_type: 'velocity_spike',
        details: JSON.stringify({ multiplier: 4.2, avg: 80, current: 336 }),
      });
      const anomalies = store.getRecentAnomalies(10);
      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].ticker).toBe('GME');
      expect(anomalies[0].anomaly_type).toBe('velocity_spike');
    });

    it('marks anomaly as notified', () => {
      store.insertAnomaly({ ticker: 'TSLA', anomaly_type: 'sentiment_flip', details: '{}' });
      const [anomaly] = store.getRecentAnomalies(1);
      store.markNotified(anomaly.id);
      const [updated] = store.getRecentAnomalies(1);
      expect(updated.notified).toBe(1);
    });
  });

  describe('pruning', () => {
    it('prunes records older than retention days', () => {
      db_raw(store).prepare("INSERT INTO snapshots (timestamp, subreddits) VALUES (datetime('now', '-31 days'), ?)").run('["wallstreetbets"]');
      store.insertSnapshot(['wallstreetbets']);
      expect(store.getRecentSnapshots(10)).toHaveLength(2);
      store.prune(30);
      expect(store.getRecentSnapshots(10)).toHaveLength(1);
    });
  });
});
