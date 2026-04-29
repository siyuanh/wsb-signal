# wsb-signal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an OpenClaw skill that tracks Reddit stock-trading communities for momentum signals, delivering scheduled digests and real-time anomaly alerts.

**Architecture:** Hybrid — three Node.js CLI tools (fetch, store, analyze) orchestrated by an LLM via SKILL.md. SQLite for historical state. Reddit API primary, web search fallback.

**Tech Stack:** Node.js 22+, snoowrap (Reddit API), better-sqlite3 (SQLite), vitest (testing)

---

## File Structure

```
wsb-signal/
├── SKILL.md
├── package.json
├── tools/
│   ├── wsb-fetch.js        # Reddit API fetcher + web search fallback
│   ├── wsb-store.js         # SQLite CRUD for snapshots, tickers, anomalies, config
│   ├── wsb-analyze.js       # Velocity, sentiment shift, anomaly detection
│   └── ticker-list.json     # Known stock tickers for filtering false positives
├── tests/
│   ├── wsb-store.test.js
│   ├── wsb-analyze.test.js
│   ├── wsb-fetch.test.js
│   └── ticker-filter.test.js
└── db/                      # Created at runtime
    ├── wsb.db
    └── config.json
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `.gitignore`

- [ ] **Step 1: Initialize package.json**

```bash
cd /Users/shua/gitws/wsb-signal
npm init -y
```

- [ ] **Step 2: Install dependencies**

```bash
npm install snoowrap better-sqlite3
npm install -D vitest
```

- [ ] **Step 3: Add test script to package.json**

Edit `package.json` scripts:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 4: Create .gitignore**

```gitignore
node_modules/
db/wsb.db
db/config.json
```

- [ ] **Step 5: Create directory stubs**

```bash
mkdir -p tools tests db
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "feat: scaffold project with dependencies"
```

---

### Task 2: Ticker List & Filter

**Files:**
- Create: `tools/ticker-list.json`
- Create: `tools/ticker-filter.js`
- Create: `tests/ticker-filter.test.js`

- [ ] **Step 1: Write failing test for ticker extraction**

Create `tests/ticker-filter.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { extractTickers } from '../tools/ticker-filter.js';

describe('extractTickers', () => {
  it('extracts $-prefixed tickers', () => {
    const text = 'I think $GME and $TSLA are going to moon';
    expect(extractTickers(text)).toContain('GME');
    expect(extractTickers(text)).toContain('TSLA');
  });

  it('extracts bare uppercase tickers from known list', () => {
    const text = 'GME is going crazy, also watching AAPL';
    expect(extractTickers(text)).toContain('GME');
    expect(extractTickers(text)).toContain('AAPL');
  });

  it('filters false positives like common words', () => {
    const text = 'I think A IT IS THE best DD on this';
    const tickers = extractTickers(text);
    expect(tickers).not.toContain('I');
    expect(tickers).not.toContain('A');
    expect(tickers).not.toContain('IT');
    expect(tickers).not.toContain('IS');
    expect(tickers).not.toContain('THE');
    expect(tickers).not.toContain('DD');
  });

  it('deduplicates tickers', () => {
    const text = '$GME GME $GME';
    expect(extractTickers(text)).toEqual(['GME']);
  });

  it('returns empty for no tickers', () => {
    expect(extractTickers('just a normal sentence')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/ticker-filter.test.js
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create ticker list**

Create `tools/ticker-list.json` — a JSON array of known stock tickers. Include the most actively traded ~4000 US tickers (NYSE + NASDAQ). For initial development, start with a representative subset:

```json
["AAPL","ABNB","ACHR","AMD","AMZN","AMC","BABA","BAC","BB","BBBY","CAR","CHWY","CLNE","CLOV","COIN","COST","CRWD","CVNA","DKNG","DRS","F","FUBO","GME","GOOG","GOOGL","HOOD","INTC","JNJ","JPM","LCID","LI","LMND","META","MMED","MNMD","MSTR","MSFT","MULN","NIO","NKLA","NOK","NVDA","OPEN","ORCL","PALR","PLTR","PYPL","QQQ","RIVN","RKLB","ROKU","SHOP","SNAP","SNOW","SOFI","SPY","SQ","TELL","TLRY","TSLA","UBER","UPST","V","WISH","WMT","XOM"]
```

- [ ] **Step 4: Implement ticker filter**

Create `tools/ticker-filter.js`:
```js
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tickerSet = new Set(
  JSON.parse(readFileSync(join(__dirname, 'ticker-list.json'), 'utf-8'))
);

const FALSE_POSITIVES = new Set([
  'I', 'A', 'AM', 'AN', 'AS', 'AT', 'BE', 'BY', 'DD', 'DO', 'GO', 'HE',
  'IF', 'IN', 'IS', 'IT', 'ME', 'MY', 'NO', 'OF', 'OK', 'ON', 'OR', 'SO',
  'THE', 'TO', 'UP', 'US', 'WE', 'ALL', 'ARE', 'BIG', 'CAN', 'CEO', 'DID',
  'FOR', 'GET', 'GOT', 'HAS', 'HAD', 'HIS', 'HOW', 'ITS', 'LET', 'MAY',
  'NEW', 'NOT', 'NOW', 'OLD', 'ONE', 'OUR', 'OUT', 'OWN', 'PUT', 'RUN',
  'SAY', 'SHE', 'THE', 'TOO', 'TOP', 'TWO', 'USE', 'WAR', 'WAY', 'WHO',
  'WHY', 'WIN', 'WON', 'YET', 'YOU', 'HOLD', 'JUST', 'LIKE', 'LONG',
  'LOOK', 'MADE', 'MAKE', 'MOON', 'MOST', 'MUCH', 'NEXT', 'ONLY', 'OVER',
  'REAL', 'SAID', 'SOME', 'SURE', 'TAKE', 'THAN', 'THAT', 'THEM', 'THEN',
  'THEY', 'THIS', 'VERY', 'WANT', 'WELL', 'WERE', 'WHAT', 'WHEN', 'WILL',
  'WITH', 'WORK', 'YOLO', 'GAIN', 'LOSS', 'BEAR', 'BULL', 'CALL', 'PUTS',
  'EDIT', 'POST', 'BEST', 'EVER', 'BEEN', 'FROM', 'GOOD', 'HAVE', 'HERE',
  'HIGH', 'HUGE', 'KEEP', 'KNOW', 'LAST', 'LIFE', 'LOL', 'LOW', 'MAN',
  'MOVE', 'NEED', 'OPEN', 'PLAY', 'RISK', 'SELL', 'STOP', 'TIME', 'TURN',
  'WEEK', 'YEAR', 'ZERO'
]);

export function extractTickers(text) {
  const found = new Set();

  const dollarPrefixed = text.matchAll(/\$([A-Z]{1,5})\b/g);
  for (const match of dollarPrefixed) {
    const sym = match[1];
    if (tickerSet.has(sym) && !FALSE_POSITIVES.has(sym)) {
      found.add(sym);
    }
  }

  const bareWords = text.matchAll(/\b([A-Z]{2,5})\b/g);
  for (const match of bareWords) {
    const sym = match[1];
    if (tickerSet.has(sym) && !FALSE_POSITIVES.has(sym)) {
      found.add(sym);
    }
  }

  return [...found];
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run tests/ticker-filter.test.js
```
Expected: all 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add tools/ticker-list.json tools/ticker-filter.js tests/ticker-filter.test.js
git commit -m "feat: add ticker extraction with false-positive filtering"
```

---

### Task 3: SQLite Store — Schema & Config

**Files:**
- Create: `tools/wsb-store.js`
- Create: `tests/wsb-store.test.js`

- [ ] **Step 1: Write failing tests for store initialization and config**

Create `tests/wsb-store.test.js`:
```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createStore } from '../tools/wsb-store.js';
import { unlinkSync, existsSync } from 'fs';

const TEST_DB = '/tmp/wsb-test.db';

describe('WsbStore', () => {
  let store;

  beforeEach(() => {
    store = createStore(TEST_DB);
  });

  afterEach(() => {
    store.close();
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/wsb-store.test.js
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement store — init, config, listTables**

Create `tools/wsb-store.js`:
```js
import Database from 'better-sqlite3';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

const DEFAULT_CONFIG = {
  subreddits: ['wallstreetbets'],
  updateFrequency: '4h',
};

export function createStore(dbPath) {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

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

  const configPath = join(dirname(dbPath), 'config.json');

  return {
    getConfig() {
      if (!existsSync(configPath)) return { ...DEFAULT_CONFIG };
      return JSON.parse(readFileSync(configPath, 'utf-8'));
    },

    saveConfig(config) {
      writeFileSync(configPath, JSON.stringify(config, null, 2));
    },

    listTables() {
      return db.prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all()
        .map(r => r.name);
    },

    close() {
      db.close();
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/wsb-store.test.js
```
Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/wsb-store.js tests/wsb-store.test.js
git commit -m "feat: add SQLite store with schema init and config management"
```

---

### Task 4: SQLite Store — Snapshots & Ticker Mentions

**Files:**
- Modify: `tools/wsb-store.js`
- Modify: `tests/wsb-store.test.js`

- [ ] **Step 1: Write failing tests for snapshot and mention CRUD**

Append to `tests/wsb-store.test.js`:
```js
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
```

- [ ] **Step 2: Run test to verify new tests fail**

```bash
npx vitest run tests/wsb-store.test.js
```
Expected: new tests FAIL — methods not defined.

- [ ] **Step 3: Implement snapshot and mention methods**

Add to the return object in `tools/wsb-store.js`:
```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/wsb-store.test.js
```
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/wsb-store.js tests/wsb-store.test.js
git commit -m "feat: add snapshot and ticker mention CRUD to store"
```

---

### Task 5: SQLite Store — Anomaly Log & Pruning

**Files:**
- Modify: `tools/wsb-store.js`
- Modify: `tests/wsb-store.test.js`

- [ ] **Step 1: Write failing tests for anomaly log and pruning**

Append to `tests/wsb-store.test.js`:
```js
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
```

Note: The `db_raw` helper needs access to the raw db. We'll expose a `_db` getter for testing:

Add to the top of the test file:
```js
function db_raw(store) {
  return store._db;
}
```

- [ ] **Step 2: Run test to verify new tests fail**

```bash
npx vitest run tests/wsb-store.test.js
```
Expected: FAIL — methods not defined.

- [ ] **Step 3: Implement anomaly and prune methods**

Add to the return object in `tools/wsb-store.js`:
```js
    _db: db,

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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/wsb-store.test.js
```
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/wsb-store.js tests/wsb-store.test.js
git commit -m "feat: add anomaly log and data pruning to store"
```

---

### Task 6: Analysis Engine

**Files:**
- Create: `tools/wsb-analyze.js`
- Create: `tests/wsb-analyze.test.js`

- [ ] **Step 1: Write failing tests for velocity detection**

Create `tests/wsb-analyze.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { detectVelocitySpikes, detectSentimentFlips, detectNewEntrants, detectSqueezeLanguage, detectOptionsSurge } from '../tools/wsb-analyze.js';

describe('detectVelocitySpikes', () => {
  it('flags ticker at 3x+ rolling average', () => {
    const current = [{ ticker: 'GME', mention_count: 300 }];
    const history = [
      { ticker: 'GME', mention_count: 80 },
      { ticker: 'GME', mention_count: 90 },
      { ticker: 'GME', mention_count: 100 },
      { ticker: 'GME', mention_count: 110 },
      { ticker: 'GME', mention_count: 120 },
    ];
    const spikes = detectVelocitySpikes(current, history);
    expect(spikes).toHaveLength(1);
    expect(spikes[0].ticker).toBe('GME');
    expect(spikes[0].multiplier).toBeGreaterThanOrEqual(3);
  });

  it('does not flag ticker below 3x', () => {
    const current = [{ ticker: 'AAPL', mention_count: 150 }];
    const history = [
      { ticker: 'AAPL', mention_count: 80 },
      { ticker: 'AAPL', mention_count: 90 },
      { ticker: 'AAPL', mention_count: 100 },
      { ticker: 'AAPL', mention_count: 110 },
      { ticker: 'AAPL', mention_count: 120 },
    ];
    expect(detectVelocitySpikes(current, history)).toHaveLength(0);
  });
});

describe('detectSentimentFlips', () => {
  it('flags ticker with 0.5+ sentiment shift', () => {
    const current = [{ ticker: 'AAPL', sentiment_score: 0.8 }];
    const previous = [{ ticker: 'AAPL', sentiment_score: 0.1 }];
    const flips = detectSentimentFlips(current, previous);
    expect(flips).toHaveLength(1);
    expect(flips[0].ticker).toBe('AAPL');
    expect(flips[0].shift).toBeCloseTo(0.7);
  });

  it('does not flag small sentiment changes', () => {
    const current = [{ ticker: 'TSLA', sentiment_score: 0.5 }];
    const previous = [{ ticker: 'TSLA', sentiment_score: 0.3 }];
    expect(detectSentimentFlips(current, previous)).toHaveLength(0);
  });
});

describe('detectNewEntrants', () => {
  it('flags tickers with no history and 10+ mentions', () => {
    const current = [{ ticker: 'CAR', mention_count: 25 }];
    const allHistoricalTickers = new Set(['GME', 'TSLA', 'AAPL']);
    const entrants = detectNewEntrants(current, allHistoricalTickers);
    expect(entrants).toHaveLength(1);
    expect(entrants[0].ticker).toBe('CAR');
  });

  it('ignores new tickers with low mentions', () => {
    const current = [{ ticker: 'XYZ', mention_count: 3 }];
    const allHistoricalTickers = new Set(['GME']);
    expect(detectNewEntrants(current, allHistoricalTickers)).toHaveLength(0);
  });
});

describe('detectSqueezeLanguage', () => {
  it('flags tickers with squeeze keywords in posts', () => {
    const posts = [
      { ticker: 'GME', text: 'GME short squeeze incoming, SI% is 140' },
      { ticker: 'TSLA', text: 'TSLA earnings look good' },
    ];
    const result = detectSqueezeLanguage(posts);
    expect(result).toContain('GME');
    expect(result).not.toContain('TSLA');
  });
});

describe('detectOptionsSurge', () => {
  it('flags tickers with high options discussion count', () => {
    const current = [{ ticker: 'GME', options_mention_count: 25 }];
    const history = [
      { ticker: 'GME', options_mention_count: 5 },
      { ticker: 'GME', options_mention_count: 6 },
      { ticker: 'GME', options_mention_count: 4 },
    ];
    const surges = detectOptionsSurge(current, history);
    expect(surges).toHaveLength(1);
    expect(surges[0].ticker).toBe('GME');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/wsb-analyze.test.js
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement analysis functions**

Create `tools/wsb-analyze.js`:
```js
const VELOCITY_THRESHOLD = 3;
const SENTIMENT_SHIFT_THRESHOLD = 0.5;
const NEW_ENTRANT_MIN_MENTIONS = 10;
const OPTIONS_SURGE_THRESHOLD = 3;
const SQUEEZE_KEYWORDS = /short squeeze|short interest|si%|days to cover|short float|heavily shorted/i;
const OPTIONS_KEYWORDS = /\byolo\b|\bcalls?\b|\bputs?\b|\bstrike\b|\bexpir[yation]/i;

export function detectVelocitySpikes(currentMentions, historicalMentions) {
  const avgByTicker = {};
  for (const h of historicalMentions) {
    if (!avgByTicker[h.ticker]) avgByTicker[h.ticker] = [];
    avgByTicker[h.ticker].push(h.mention_count);
  }

  const spikes = [];
  for (const m of currentMentions) {
    const hist = avgByTicker[m.ticker];
    if (!hist || hist.length === 0) continue;
    const avg = hist.reduce((a, b) => a + b, 0) / hist.length;
    if (avg === 0) continue;
    const multiplier = m.mention_count / avg;
    if (multiplier >= VELOCITY_THRESHOLD) {
      spikes.push({ ticker: m.ticker, multiplier: Math.round(multiplier * 10) / 10, avg: Math.round(avg), current: m.mention_count });
    }
  }
  return spikes;
}

export function detectSentimentFlips(currentMentions, previousMentions) {
  const prevByTicker = {};
  for (const p of previousMentions) {
    prevByTicker[p.ticker] = p.sentiment_score;
  }

  const flips = [];
  for (const m of currentMentions) {
    if (!(m.ticker in prevByTicker)) continue;
    const shift = m.sentiment_score - prevByTicker[m.ticker];
    if (Math.abs(shift) >= SENTIMENT_SHIFT_THRESHOLD) {
      flips.push({ ticker: m.ticker, shift, from: prevByTicker[m.ticker], to: m.sentiment_score });
    }
  }
  return flips;
}

export function detectNewEntrants(currentMentions, allHistoricalTickers) {
  return currentMentions
    .filter(m => !allHistoricalTickers.has(m.ticker) && m.mention_count >= NEW_ENTRANT_MIN_MENTIONS)
    .map(m => ({ ticker: m.ticker, mention_count: m.mention_count }));
}

export function detectSqueezeLanguage(posts) {
  const tickers = new Set();
  for (const p of posts) {
    if (SQUEEZE_KEYWORDS.test(p.text)) {
      tickers.add(p.ticker);
    }
  }
  return [...tickers];
}

export function detectOptionsSurge(currentMentions, historicalMentions) {
  const avgByTicker = {};
  for (const h of historicalMentions) {
    if (!avgByTicker[h.ticker]) avgByTicker[h.ticker] = [];
    avgByTicker[h.ticker].push(h.options_mention_count);
  }

  const surges = [];
  for (const m of currentMentions) {
    const hist = avgByTicker[m.ticker];
    if (!hist || hist.length === 0) continue;
    const avg = hist.reduce((a, b) => a + b, 0) / hist.length;
    if (avg === 0) continue;
    const multiplier = m.options_mention_count / avg;
    if (multiplier >= OPTIONS_SURGE_THRESHOLD) {
      surges.push({ ticker: m.ticker, multiplier: Math.round(multiplier * 10) / 10, avg: Math.round(avg), current: m.options_mention_count });
    }
  }
  return surges;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/wsb-analyze.test.js
```
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/wsb-analyze.js tests/wsb-analyze.test.js
git commit -m "feat: add analysis engine with velocity, sentiment, squeeze, and options detection"
```

---

### Task 7: Reddit Fetcher

**Files:**
- Create: `tools/wsb-fetch.js`
- Create: `tests/wsb-fetch.test.js`

- [ ] **Step 1: Write failing tests for fetch result parsing**

Create `tests/wsb-fetch.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { parseRedditPosts, countOptionsMentions } from '../tools/wsb-fetch.js';

describe('parseRedditPosts', () => {
  it('extracts structured data from raw reddit post objects', () => {
    const rawPosts = [
      {
        title: '$GME to the moon',
        selftext: 'Short squeeze incoming, SI% is crazy',
        score: 2400,
        upvote_ratio: 0.95,
        num_comments: 580,
        author: { name: 'diamondhand42' },
        created_utc: 1714400000,
        permalink: '/r/wallstreetbets/comments/abc123',
        subreddit: { display_name: 'wallstreetbets' },
        total_awards_received: 15,
      },
    ];
    const parsed = parseRedditPosts(rawPosts);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe('$GME to the moon');
    expect(parsed[0].score).toBe(2400);
    expect(parsed[0].subreddit).toBe('wallstreetbets');
    expect(parsed[0].fullText).toContain('Short squeeze incoming');
  });
});

describe('countOptionsMentions', () => {
  it('counts posts with options-related language per ticker', () => {
    const posts = [
      { tickers: ['GME'], fullText: 'buying GME 25c YOLO expiry friday' },
      { tickers: ['GME'], fullText: 'GME is going up' },
      { tickers: ['TSLA'], fullText: 'TSLA puts printing' },
    ];
    const counts = countOptionsMentions(posts);
    expect(counts.GME).toBe(1);
    expect(counts.TSLA).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/wsb-fetch.test.js
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement wsb-fetch**

Create `tools/wsb-fetch.js`:
```js
import Snoowrap from 'snoowrap';
import { extractTickers } from './ticker-filter.js';

const OPTIONS_KEYWORDS = /\byolo\b|\bcalls?\b|\bputs?\b|\bstrike\b|\bexpir[yation]/i;

export function parseRedditPosts(rawPosts) {
  return rawPosts.map(p => {
    const fullText = `${p.title} ${p.selftext || ''}`;
    return {
      title: p.title,
      body: p.selftext || '',
      fullText,
      score: p.score,
      upvote_ratio: p.upvote_ratio,
      num_comments: p.num_comments,
      author: p.author?.name || '[deleted]',
      created_utc: p.created_utc,
      permalink: p.permalink,
      subreddit: p.subreddit?.display_name || '',
      awards: p.total_awards_received || 0,
      tickers: extractTickers(fullText),
    };
  });
}

export function countOptionsMentions(posts) {
  const counts = {};
  for (const p of posts) {
    if (OPTIONS_KEYWORDS.test(p.fullText)) {
      for (const t of p.tickers) {
        counts[t] = (counts[t] || 0) + 1;
      }
    }
  }
  return counts;
}

function createRedditClient() {
  return new Snoowrap({
    userAgent: 'wsb-signal:v1.0.0',
    clientId: process.env.REDDIT_CLIENT_ID,
    clientSecret: process.env.REDDIT_CLIENT_SECRET,
    username: process.env.REDDIT_USERNAME,
    password: process.env.REDDIT_PASSWORD,
  });
}

export async function fetchSubreddit(subredditName) {
  const reddit = createRedditClient();
  const sub = reddit.getSubreddit(subredditName);

  const [hot, rising, newest] = await Promise.all([
    sub.getHot({ limit: 100 }),
    sub.getRising({ limit: 100 }),
    sub.getNew({ limit: 100 }),
  ]);

  const seen = new Set();
  const allPosts = [];
  for (const post of [...hot, ...rising, ...newest]) {
    if (seen.has(post.id)) continue;
    seen.add(post.id);
    allPosts.push(post);
  }

  return parseRedditPosts(allPosts);
}

export async function fetchAllSubreddits(subredditNames) {
  const results = {};
  for (const name of subredditNames) {
    try {
      results[name] = await fetchSubreddit(name);
    } catch (err) {
      results[name] = { error: err.message };
    }
  }
  return results;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/wsb-fetch.test.js
```
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/wsb-fetch.js tests/wsb-fetch.test.js
git commit -m "feat: add Reddit fetcher with post parsing and options detection"
```

---

### Task 8: CLI Tool Wrappers

Each tool needs a CLI entry point so OpenClaw can invoke them. These are thin wrappers that read stdin/args, call the library functions, and print JSON to stdout.

**Files:**
- Create: `tools/bin/fetch.js`
- Create: `tools/bin/store.js`
- Create: `tools/bin/analyze.js`

- [ ] **Step 1: Create bin directory**

```bash
mkdir -p tools/bin
```

- [ ] **Step 2: Create fetch CLI**

Create `tools/bin/fetch.js`:
```js
#!/usr/bin/env node
import { fetchAllSubreddits } from '../wsb-fetch.js';

const subreddits = process.argv.slice(2);
if (subreddits.length === 0) {
  console.error('Usage: fetch.js <subreddit1> [subreddit2] ...');
  process.exit(1);
}

const results = await fetchAllSubreddits(subreddits);
console.log(JSON.stringify(results, null, 2));
```

- [ ] **Step 3: Create store CLI**

Create `tools/bin/store.js`:
```js
#!/usr/bin/env node
import { createStore } from '../wsb-store.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '..', '..', 'db', 'wsb.db');
const store = createStore(dbPath);

const command = process.argv[2];
const arg = process.argv[3];

const commands = {
  'get-config': () => store.getConfig(),
  'save-config': () => {
    const config = JSON.parse(arg);
    store.saveConfig(config);
    return { ok: true };
  },
  'insert-snapshot': () => {
    const subreddits = JSON.parse(arg);
    return { id: store.insertSnapshot(subreddits) };
  },
  'get-recent-snapshots': () => store.getRecentSnapshots(parseInt(arg) || 10),
  'insert-mention': () => {
    store.insertMention(JSON.parse(arg));
    return { ok: true };
  },
  'get-mentions': () => store.getMentionsForSnapshot(parseInt(arg)),
  'get-ticker-history': () => {
    const [ticker, limit] = arg.split(',');
    return store.getTickerHistory(ticker, parseInt(limit) || 10);
  },
  'get-recent-anomalies': () => store.getRecentAnomalies(parseInt(arg) || 20),
  'insert-anomaly': () => {
    const id = store.insertAnomaly(JSON.parse(arg));
    return { id };
  },
  'mark-notified': () => {
    store.markNotified(parseInt(arg));
    return { ok: true };
  },
  'prune': () => {
    store.prune(parseInt(arg) || 30);
    return { ok: true };
  },
};

if (!commands[command]) {
  console.error(`Unknown command: ${command}\nAvailable: ${Object.keys(commands).join(', ')}`);
  process.exit(1);
}

console.log(JSON.stringify(commands[command]()));
store.close();
```

- [ ] **Step 4: Create analyze CLI**

Create `tools/bin/analyze.js`:
```js
#!/usr/bin/env node
import { detectVelocitySpikes, detectSentimentFlips, detectNewEntrants, detectSqueezeLanguage, detectOptionsSurge } from '../wsb-analyze.js';

const input = JSON.parse(process.argv[2]);
const command = input.command;

const commands = {
  'velocity': () => detectVelocitySpikes(input.current, input.history),
  'sentiment': () => detectSentimentFlips(input.current, input.previous),
  'new-entrants': () => detectNewEntrants(input.current, new Set(input.historicalTickers)),
  'squeeze': () => detectSqueezeLanguage(input.posts),
  'options': () => detectOptionsSurge(input.current, input.history),
  'full': () => ({
    velocitySpikes: detectVelocitySpikes(input.current, input.history),
    sentimentFlips: detectSentimentFlips(input.current, input.previous),
    newEntrants: detectNewEntrants(input.current, new Set(input.historicalTickers)),
    squeezeCandidates: detectSqueezeLanguage(input.posts),
    optionsSurges: detectOptionsSurge(input.currentOptions, input.optionsHistory),
  }),
};

if (!commands[command]) {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}

console.log(JSON.stringify(commands[command](), null, 2));
```

- [ ] **Step 5: Make bin files executable**

```bash
chmod +x tools/bin/fetch.js tools/bin/store.js tools/bin/analyze.js
```

- [ ] **Step 6: Commit**

```bash
git add tools/bin/
git commit -m "feat: add CLI wrappers for fetch, store, and analyze tools"
```

---

### Task 9: SKILL.md

**Files:**
- Create: `SKILL.md`

- [ ] **Step 1: Write the SKILL.md**

Create `SKILL.md`:
````markdown
---
name: wsb-signal
description: Track WallStreetBets momentum — scheduled digests + anomaly alerts for trending tickers, sentiment shifts, short squeeze candidates, and options activity
metadata:
  openclaw:
    requires:
      env:
        - REDDIT_CLIENT_ID
        - REDDIT_CLIENT_SECRET
        - REDDIT_USERNAME
        - REDDIT_PASSWORD
      bins:
        - node
    primaryEnv: REDDIT_CLIENT_ID
---

# WSB Signal

You are a stock market momentum tracker focused on Reddit communities. You monitor subreddits (default: r/wallstreetbets) for emerging opportunities by tracking ticker mention velocity, sentiment shifts, short squeeze candidates, and unusual options activity.

## Tools

You have three tools available as CLI commands. All accept and return JSON.

### wsb-fetch

Fetches posts from configured subreddits via Reddit API.

```bash
node tools/bin/fetch.js wallstreetbets stocks
```

Returns: JSON object keyed by subreddit, each containing an array of parsed posts with extracted tickers.

### wsb-store

Manages the SQLite database for historical tracking and config.

```bash
node tools/bin/store.js <command> [arg]
```

Commands:
- `get-config` — returns current config (subreddits, updateFrequency)
- `save-config '{"subreddits":["wallstreetbets"],"updateFrequency":"4h"}'`
- `insert-snapshot '["wallstreetbets"]'` — returns `{ id }`
- `get-recent-snapshots 10`
- `insert-mention '<json>'` — insert a ticker mention record
- `get-mentions <snapshot_id>`
- `get-ticker-history 'GME,10'`
- `get-recent-anomalies 20`
- `insert-anomaly '<json>'`
- `mark-notified <id>`
- `prune 30`

### wsb-analyze

Runs anomaly detection algorithms on collected data.

```bash
node tools/bin/analyze.js '<json>'
```

Pass `{ "command": "full", ... }` for a complete analysis. Individual commands: `velocity`, `sentiment`, `new-entrants`, `squeeze`, `options`.

## Workflow

### On-Demand Query

When the user asks about WSB trends:

1. Read config with `wsb-store get-config`
2. Fetch data with `wsb-fetch` for each configured subreddit
3. Store the snapshot and mentions via `wsb-store`
4. Run analysis via `wsb-analyze` with the `full` command
5. Log any anomalies via `wsb-store insert-anomaly`
6. Present findings in the digest format below

### Scheduled Update

Run the on-demand workflow automatically at the user's configured interval. If anomalies are detected, alert immediately.

### User Commands

- **"What's trending on WSB?"** — run full on-demand workflow
- **"Update me every N hours"** — update config via `wsb-store save-config`
- **"Add r/subreddit to my watchlist"** — update subreddits in config
- **"Tell me more about $TICKER"** — run `wsb-store get-ticker-history` and summarize
- **"What were the biggest movers this week?"** — query historical snapshots and rank by velocity
- **"Stop updates"** — pause scheduled runs by clearing updateFrequency

## Digest Format

```
WSB Momentum Report — {date} {time}

Top 5 Tickers by Mention Velocity
1. $TICKER — N mentions (Xx avg) | Sentiment: {direction} (score)
...

Short Squeeze Candidates
- $TICKER — {reason}

Hottest Options Plays
- $TICKER {strike}{type} — mentioned in N posts

Biggest Sentiment Shifts
- $TICKER — flipped {from} to {to} ({shift} in {timeframe})

Hottest Thread
"{title}" — {score} upvotes in {age}
{url}

Tracking: {subreddits} | Next update: {time}
```

## Anomaly Alert Format

```
WSB Anomaly Detected

$TICKER — {anomaly_type}
{description of what changed and by how much}
Sentiment: {direction} (score)
Top thread: "{title}" {url}

Source: {subreddit}
```

## Sentiment Scoring

When analyzing posts for a ticker, score sentiment from -1.0 (extremely bearish) to 1.0 (extremely bullish). Consider:
- Language tone (rocket emojis = bullish, "bagholder" = bearish)
- Position descriptions (buying/holding = bullish, selling/shorting = bearish)
- Conviction level (YOLO = high conviction)
- Context (loss porn with positive tone = still bullish community)
````

- [ ] **Step 2: Commit**

```bash
git add SKILL.md
git commit -m "feat: add SKILL.md with tool declarations and LLM prompt"
```

---

### Task 10: Integration Test

**Files:**
- Create: `tests/integration.test.js`

- [ ] **Step 1: Write integration test that exercises the full pipeline**

Create `tests/integration.test.js`:
```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createStore } from '../tools/wsb-store.js';
import { parseRedditPosts, countOptionsMentions } from '../tools/wsb-fetch.js';
import { extractTickers } from '../tools/ticker-filter.js';
import { detectVelocitySpikes, detectSentimentFlips, detectNewEntrants, detectSqueezeLanguage, detectOptionsSurge } from '../tools/wsb-analyze.js';
import { unlinkSync, existsSync } from 'fs';

const TEST_DB = '/tmp/wsb-integration-test.db';

describe('full pipeline integration', () => {
  let store;

  beforeEach(() => {
    store = createStore(TEST_DB);
  });

  afterEach(() => {
    store.close();
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  });

  it('detects a GME-like velocity spike across multiple snapshots', () => {
    // Simulate 5 historical snapshots with normal GME activity
    for (let i = 0; i < 5; i++) {
      const snapId = store.insertSnapshot(['wallstreetbets']);
      store.insertMention({
        snapshot_id: snapId, ticker: 'GME', mention_count: 20 + i * 5,
        post_count: 5, avg_score: 50, avg_upvote_ratio: 0.8,
        sentiment_score: 0.2, top_post_url: '', subreddit: 'wallstreetbets',
      });
    }

    // Current snapshot: GME explodes
    const currentSnap = store.insertSnapshot(['wallstreetbets']);
    store.insertMention({
      snapshot_id: currentSnap, ticker: 'GME', mention_count: 350,
      post_count: 80, avg_score: 500, avg_upvote_ratio: 0.96,
      sentiment_score: 0.9, top_post_url: 'https://reddit.com/r/wsb/gme-moon',
      subreddit: 'wallstreetbets',
    });

    const current = store.getMentionsForSnapshot(currentSnap);
    const history = store.getTickerHistory('GME', 5).slice(1); // exclude current

    const spikes = detectVelocitySpikes(current, history);
    expect(spikes).toHaveLength(1);
    expect(spikes[0].ticker).toBe('GME');
    expect(spikes[0].multiplier).toBeGreaterThan(10);

    // Detect sentiment flip
    const previousSnap = store.getRecentSnapshots(2)[1];
    const previousMentions = store.getMentionsForSnapshot(previousSnap.id);
    const flips = detectSentimentFlips(current, previousMentions);
    expect(flips).toHaveLength(1);
    expect(flips[0].ticker).toBe('GME');
    expect(flips[0].shift).toBeGreaterThanOrEqual(0.5);

    // Log the anomaly
    const anomalyId = store.insertAnomaly({
      ticker: 'GME',
      anomaly_type: 'velocity_spike',
      details: JSON.stringify(spikes[0]),
    });
    expect(anomalyId).toBeGreaterThan(0);
  });

  it('detects a new entrant like CAR', () => {
    // One historical snapshot with only GME
    const s1 = store.insertSnapshot(['wallstreetbets']);
    store.insertMention({
      snapshot_id: s1, ticker: 'GME', mention_count: 100,
      post_count: 20, avg_score: 200, avg_upvote_ratio: 0.9,
      sentiment_score: 0.5, top_post_url: '', subreddit: 'wallstreetbets',
    });

    // New snapshot: CAR appears
    const s2 = store.insertSnapshot(['wallstreetbets']);
    store.insertMention({
      snapshot_id: s2, ticker: 'CAR', mention_count: 45,
      post_count: 12, avg_score: 350, avg_upvote_ratio: 0.94,
      sentiment_score: 0.85, top_post_url: '', subreddit: 'wallstreetbets',
    });

    const current = store.getMentionsForSnapshot(s2);
    const entrants = detectNewEntrants(current, new Set(['GME']));
    expect(entrants).toHaveLength(1);
    expect(entrants[0].ticker).toBe('CAR');
  });

  it('parses reddit posts and extracts tickers end-to-end', () => {
    const rawPosts = [
      {
        title: '$GME short squeeze is happening',
        selftext: 'SI% is over 100, days to cover is insane. Buying $GME calls expiry friday',
        score: 3500,
        upvote_ratio: 0.97,
        num_comments: 1200,
        author: { name: 'yolo_trader' },
        created_utc: Date.now() / 1000,
        permalink: '/r/wallstreetbets/comments/xyz',
        subreddit: { display_name: 'wallstreetbets' },
        total_awards_received: 42,
      },
    ];

    const parsed = parseRedditPosts(rawPosts);
    expect(parsed[0].tickers).toContain('GME');

    const squeezeTickers = detectSqueezeLanguage(
      parsed.map(p => ({ ticker: p.tickers[0], text: p.fullText }))
    );
    expect(squeezeTickers).toContain('GME');

    const optionsCounts = countOptionsMentions(parsed);
    expect(optionsCounts.GME).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

```bash
npx vitest run tests/integration.test.js
```
Expected: all 3 tests PASS.

- [ ] **Step 3: Run full test suite**

```bash
npx vitest run
```
Expected: all tests across all files PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/integration.test.js
git commit -m "feat: add integration tests for full pipeline"
```

---

### Task 11: Update CLAUDE.md and README

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

- [ ] **Step 1: Update CLAUDE.md with project details**

Replace contents of `CLAUDE.md`:
```markdown
# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project

wsb-signal — an OpenClaw skill that tracks Reddit stock-trading communities for momentum signals.

## Commands

- `npm test` — run all tests with vitest
- `npm run test:watch` — run tests in watch mode

## Structure

- `SKILL.md` — OpenClaw skill definition
- `tools/` — Node.js tool implementations (wsb-fetch, wsb-store, wsb-analyze)
- `tools/bin/` — CLI entry points for each tool
- `tests/` — vitest test files
- `db/` — runtime SQLite database and config (gitignored)

## Dependencies

- snoowrap (Reddit API)
- better-sqlite3 (SQLite)
- vitest (testing)
```

- [ ] **Step 2: Update README.md**

Replace contents of `README.md`:
```markdown
# wsb-signal

An OpenClaw skill that tracks Reddit stock-trading communities (default: r/wallstreetbets) for momentum signals. Delivers scheduled digests and real-time anomaly alerts for trending tickers, sentiment shifts, short squeeze candidates, and unusual options activity.

## Setup

1. Install dependencies: `npm install`
2. Set environment variables:
   - `REDDIT_CLIENT_ID`
   - `REDDIT_CLIENT_SECRET`
   - `REDDIT_USERNAME`
   - `REDDIT_PASSWORD`
3. Copy this skill to `~/.openclaw/workspace/skills/wsb-signal/`

## Usage

Tell the skill what you want:
- "What's trending on WSB?"
- "Update me every 2 hours"
- "Add r/stocks to my watchlist"
- "Tell me more about $GME"
- "Stop updates"

## Development

Run tests: `npm test`
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: update CLAUDE.md and README with project details"
```
