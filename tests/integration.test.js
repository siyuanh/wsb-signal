import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createStore } from '../tools/wsb-store.js';
import { parseRedditPosts, countOptionsMentions } from '../tools/wsb-fetch.js';
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
    for (let i = 0; i < 5; i++) {
      const snapId = store.insertSnapshot(['wallstreetbets']);
      store.insertMention({
        snapshot_id: snapId, ticker: 'GME', mention_count: 20 + i * 5,
        post_count: 5, avg_score: 50, avg_upvote_ratio: 0.8,
        sentiment_score: 0.2, top_post_url: '', subreddit: 'wallstreetbets',
      });
    }

    const currentSnap = store.insertSnapshot(['wallstreetbets']);
    store.insertMention({
      snapshot_id: currentSnap, ticker: 'GME', mention_count: 350,
      post_count: 80, avg_score: 500, avg_upvote_ratio: 0.96,
      sentiment_score: 0.9, top_post_url: 'https://reddit.com/r/wsb/gme-moon',
      subreddit: 'wallstreetbets',
    });

    const current = store.getMentionsForSnapshot(currentSnap);
    // getTickerHistory returns newest first, so slice off the current snapshot
    const allHistory = store.getTickerHistory('GME', 10);
    const history = allHistory.filter(h => h.snapshot_id !== currentSnap);

    const spikes = detectVelocitySpikes(current, history);
    expect(spikes).toHaveLength(1);
    expect(spikes[0].ticker).toBe('GME');
    expect(spikes[0].multiplier).toBeGreaterThan(3);

    const previousSnap = store.getRecentSnapshots(2)[1];
    const previousMentions = store.getMentionsForSnapshot(previousSnap.id);
    const flips = detectSentimentFlips(current, previousMentions);
    expect(flips).toHaveLength(1);
    expect(flips[0].ticker).toBe('GME');
    expect(flips[0].shift).toBeGreaterThanOrEqual(0.5);

    const anomalyId = store.insertAnomaly({
      ticker: 'GME',
      anomaly_type: 'velocity_spike',
      details: JSON.stringify(spikes[0]),
    });
    expect(anomalyId).toBeGreaterThan(0);
  });

  it('detects a new entrant like CAR', () => {
    const s1 = store.insertSnapshot(['wallstreetbets']);
    store.insertMention({
      snapshot_id: s1, ticker: 'GME', mention_count: 100,
      post_count: 20, avg_score: 200, avg_upvote_ratio: 0.9,
      sentiment_score: 0.5, top_post_url: '', subreddit: 'wallstreetbets',
    });

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
