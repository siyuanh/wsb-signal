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
