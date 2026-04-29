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

The ticker filter auto-learns new symbols it encounters via `$`-prefixed mentions (e.g., `$NEWSTOCK`), so the system gets smarter over time.

## Development

Run tests: `npm test`
