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
