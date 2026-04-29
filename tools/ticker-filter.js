import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const builtinTickers = new Set(
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
  'WEEK', 'YEAR', 'ZERO',
]);

const DEFAULT_LEARNED_PATH = join(__dirname, '..', 'db', 'learned-tickers.json');

export function createTickerFilter(learnedPath = DEFAULT_LEARNED_PATH) {
  const learned = new Set(loadLearned(learnedPath));

  function isKnown(sym) {
    return builtinTickers.has(sym) || learned.has(sym);
  }

  function learn(sym) {
    if (!learned.has(sym)) {
      learned.add(sym);
      saveLearned(learnedPath, [...learned]);
    }
  }

  function extractTickers(text) {
    const found = new Set();

    for (const match of text.matchAll(/\$([A-Z]{1,5})\b/g)) {
      const sym = match[1];
      if (FALSE_POSITIVES.has(sym)) continue;
      if (!isKnown(sym)) learn(sym);
      found.add(sym);
    }

    for (const match of text.matchAll(/\b([A-Z]{2,5})\b/g)) {
      const sym = match[1];
      if (FALSE_POSITIVES.has(sym)) continue;
      if (isKnown(sym)) found.add(sym);
    }

    return [...found];
  }

  return {
    extractTickers,
    getLearnedTickers: () => [...learned],
  };
}

function loadLearned(path) {
  if (!existsSync(path)) return [];
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return [];
  }
}

function saveLearned(path, tickers) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(tickers));
}
