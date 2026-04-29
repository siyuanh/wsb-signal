# wsb-signal

An OpenClaw skill that tracks Reddit stock-trading communities (default: r/wallstreetbets) for momentum signals. Delivers scheduled digests and real-time anomaly alerts for trending tickers, sentiment shifts, short squeeze candidates, and unusual options activity.

## Installation

### OpenClaw

```bash
git clone https://github.com/siyuanh/wsb-signal.git ~/.openclaw/workspace/skills/wsb-signal
cd ~/.openclaw/workspace/skills/wsb-signal
npm install
```

### Hermes Agent

```bash
git clone https://github.com/siyuanh/wsb-signal.git ~/.hermes/skills/wsb-signal
cd ~/.hermes/skills/wsb-signal
npm install
```

Then activate in a Hermes session with `/wsb-signal` or ask "What's trending on WSB?"

### Environment Variables

Set these for Reddit API access:

```bash
export REDDIT_CLIENT_ID="your_client_id"
export REDDIT_CLIENT_SECRET="your_client_secret"
export REDDIT_USERNAME="your_username"
export REDDIT_PASSWORD="your_password"
```

Without these, the skill falls back to web search (OpenClaw search skill or Google).

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
