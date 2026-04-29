# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project

wsb-signal — an OpenClaw skill that tracks Reddit stock-trading communities for momentum signals.

## Commands

- `npm test` — run all tests with vitest
- `npm run test:watch` — run tests in watch mode

## Structure

- `SKILL.md` — OpenClaw skill definition
- `tools/` — Node.js tool implementations (wsb-fetch, wsb-store, wsb-analyze, ticker-filter)
- `tools/bin/` — CLI entry points for each tool
- `tests/` — vitest test files
- `db/` — runtime SQLite database, config, and learned tickers (gitignored)

## Dependencies

- snoowrap (Reddit API)
- better-sqlite3 (SQLite)
- vitest (testing)
