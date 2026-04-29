import Snoowrap from 'snoowrap';
import { createTickerFilter } from './ticker-filter.js';

const OPTIONS_KEYWORDS = /\byolo\b|\bcalls?\b|\bputs?\b|\bstrike\b|\bexpir[yation]/i;

const filter = createTickerFilter();

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
      tickers: filter.extractTickers(fullText),
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
