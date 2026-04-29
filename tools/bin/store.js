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
