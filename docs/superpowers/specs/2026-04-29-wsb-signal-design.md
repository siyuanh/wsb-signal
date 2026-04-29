# wsb-signal Design Spec

An OpenClaw skill that tracks Reddit stock-trading communities (default: r/wallstreetbets) for momentum signals, delivering scheduled digests and real-time anomaly alerts directly in the user's session. The goal is to catch emerging opportunities like GME and CAR early by monitoring ticker velocity, sentiment shifts, short squeeze candidates, and options activity.

## Architecture Overview

Hybrid approach: dedicated Node.js tools handle data collection and storage, while the LLM orchestrates tool calls, performs sentiment analysis, interprets patterns, and communicates findings in natural language.

```
User Session
    │
    ▼
SKILL.md (LLM prompt + tool declarations)
    │
    ├── wsb-fetch.js    → Reddit API / web search fallback
    ├── wsb-store.js    → SQLite read/write
    └── wsb-analyze.js  → Velocity, sentiment, anomaly computation
         │
         ▼
      db/wsb.db (SQLite — historical snapshots, ticker data, anomaly log)
```

## Skill Structure

```
~/.openclaw/workspace/skills/wsb-signal/
├── SKILL.md              # Skill definition (prompt, metadata, tool declarations)
├── tools/
│   ├── wsb-fetch.js      # Reddit API fetcher + web search fallback
│   ├── wsb-store.js      # Read/write historical data to SQLite
│   └── wsb-analyze.js    # Compute velocity, sentiment shifts, anomalies
├── db/
│   ├── wsb.db            # SQLite database (created at runtime)
│   └── config.json       # User-configurable settings
└── package.json          # Dependencies (snoowrap, better-sqlite3)
```

### SKILL.md Frontmatter

```yaml
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
```

## Data Collection

### Primary: Reddit API (via snoowrap)

The `wsb-fetch` tool collects from one or more configurable subreddits (default: `r/wallstreetbets`). Users can add others (e.g., `r/stocks`, `r/options`, `r/squeezeplays`) by telling the skill.

For each subreddit it collects:
- **Hot/Rising/New posts** (top 100 each)
- Per post: title, body, score, upvote ratio, comment count, awards, author, timestamp, source subreddit
- **Top-level comments** from the hottest posts for deeper sentiment mining

Ticker extraction uses regex matching against a bundled stock ticker list to filter false positives (common words like "I", "A", "IT", "DD"). The ticker list is refreshable.

When data comes from multiple subreddits, mentions are aggregated — a ticker trending across multiple subs is a stronger signal than one sub alone.

### Fallback: Web Search

When the Reddit API is rate-limited or credentials aren't configured, the tool falls back to web search to extract the same signals. Two options in priority order:
1. **OpenClaw search skill** — if installed, use it as the search provider
2. **Google search** — direct Google search as a last resort

Less structured than the Reddit API but still useful for catching trending tickers and sentiment.

### User-Configurable Settings

Stored in `db/config.json`:
- `subreddits`: list of subreddits to track (default: `["wallstreetbets"]`)
- `updateFrequency`: interval string (default: `"4h"`, weekdays only)

Users configure these via natural language (e.g., "update me every 2 hours", "add r/stocks").

## Data Storage

SQLite database at `db/wsb.db` with three core tables.

### snapshots

| Column | Type | Purpose |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| timestamp | DATETIME | When the snapshot was taken |
| subreddits | TEXT | JSON array of subs scanned |

### ticker_mentions

| Column | Type | Purpose |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| snapshot_id | FK | Links to snapshot |
| ticker | TEXT | Stock symbol (e.g., "GME") |
| mention_count | INTEGER | Total mentions across posts + comments |
| post_count | INTEGER | Number of distinct posts mentioning it |
| avg_score | REAL | Average post score |
| avg_upvote_ratio | REAL | Average upvote ratio |
| sentiment_score | REAL | -1.0 (bearish) to 1.0 (bullish) |
| top_post_url | TEXT | Highest-scored post mentioning this ticker |
| subreddit | TEXT | Which sub this data came from |

### anomaly_log

| Column | Type | Purpose |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| timestamp | DATETIME | When anomaly was detected |
| ticker | TEXT | Stock symbol |
| anomaly_type | TEXT | e.g., "velocity_spike", "sentiment_flip", "squeeze_candidate" |
| details | TEXT | JSON with specifics (magnitude, context) |
| notified | BOOLEAN | Whether user was alerted |

Data retention: 30 days by default, auto-prune older records on each run.

## Analysis & Anomaly Detection

The `wsb-analyze` tool compares the current snapshot against historical data and produces two outputs: a scheduled digest and anomaly alerts when thresholds are crossed.

### Signals

**Velocity detection:**
- Compare current mention count against the rolling average of the last 5 snapshots
- Flag a ticker if mentions are 3x+ the rolling average
- Flag tickers appearing for the first time with significant volume (new entrant detection)

**Sentiment analysis:**
- The LLM scores each ticker's sentiment from posts/comments (-1.0 to 1.0)
- Flag when a ticker's sentiment shifts by 0.5+ points between snapshots

**Short squeeze candidates:**
- Cross-reference trending tickers against mentions of "short squeeze", "short interest", "SI%", "days to cover" in posts
- Flag tickers with both high mention velocity AND squeeze-related language

**Options activity:**
- Detect posts discussing unusual options plays — "YOLO", "calls", "puts", specific strike prices and expiry dates
- Flag tickers with a sudden spike in options-related discussion

**Post engagement velocity:**
- Track posts gaining upvotes/awards unusually fast relative to their age
- Surface these as "hot threads" in the digest

### Anomaly Alert Triggers

| Type | Trigger |
|---|---|
| `velocity_spike` | Mentions 3x+ rolling average |
| `sentiment_flip` | Sentiment shift >= 0.5 points |
| `squeeze_candidate` | High velocity + squeeze language |
| `options_surge` | Sudden spike in options discussion |
| `new_entrant` | First appearance with 10+ mentions |

## Output Format

### Scheduled Digest

```
WSB Momentum Report — Apr 29, 2026 2:00 PM

Top 5 Tickers by Mention Velocity
1. $GME — 342 mentions (4.2x avg) | Sentiment: Bullish (0.8)
2. $TSLA — 198 mentions (1.8x avg) | Sentiment: Neutral (0.1)
...

Short Squeeze Candidates
- $GME — high SI% discussion + 4.2x velocity spike

Hottest Options Plays
- $GME 4/30 $25c — mentioned in 47 posts, "YOLO" sentiment

Biggest Sentiment Shifts
- $AAPL — flipped bearish to bullish (+0.6 in 4h)

Hottest Thread
"GME is about to blow" — 2.4k upvotes in 2h
[link]

Tracking: r/wallstreetbets, r/options | Next update: 6:00 PM
```

### Anomaly Alert

```
WSB Anomaly Detected

$CAR — velocity_spike
Mentions jumped from ~12 avg to 89 in the last snapshot (7.4x)
Sentiment: Strongly Bullish (0.9)
Top thread: "CAR is the next squeeze" [link]

Source: r/wallstreetbets
```

## Skill Interaction

Users interact in natural language within their OpenClaw session:

- "What's trending on WSB?" — triggers on-demand fetch + analysis
- "Update me every 2 hours" — updates the schedule config
- "Add r/stocks to my watchlist" — adds a subreddit
- "Tell me more about $GME" — deep dive on a specific ticker's history and sentiment
- "What were the biggest movers this week?" — queries historical data
- "Stop updates" — pauses scheduled runs

The SKILL.md prompt instructs the LLM how to interpret these requests and call the appropriate tools.

## Dependencies

- **snoowrap** — Reddit API wrapper for Node.js
- **better-sqlite3** — Synchronous SQLite bindings for Node.js
- **Node.js 22.14+** — OpenClaw runtime requirement

## Future Considerations (Not In Scope)

- Publishing to ClawhHub
- External channel delivery (Telegram, Discord)
- Configurable anomaly thresholds
- Custom ticker watchlists (alert only on specific tickers)
- Integration with financial data APIs for price/volume correlation
