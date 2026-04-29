const VELOCITY_THRESHOLD = 3;
const SENTIMENT_SHIFT_THRESHOLD = 0.5;
const NEW_ENTRANT_MIN_MENTIONS = 10;
const OPTIONS_SURGE_THRESHOLD = 3;
const SQUEEZE_KEYWORDS = /short squeeze|short interest|si%|days to cover|short float|heavily shorted/i;

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
