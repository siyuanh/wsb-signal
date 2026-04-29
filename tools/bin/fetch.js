#!/usr/bin/env node
import { fetchAllSubreddits } from '../wsb-fetch.js';

const subreddits = process.argv.slice(2);
if (subreddits.length === 0) {
  console.error('Usage: fetch.js <subreddit1> [subreddit2] ...');
  process.exit(1);
}

const results = await fetchAllSubreddits(subreddits);
console.log(JSON.stringify(results, null, 2));
