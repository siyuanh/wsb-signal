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
});
