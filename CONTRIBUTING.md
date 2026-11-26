# Contributing

Thanks for the interest. This project is small on purpose, and it should stay that way.

## What this project does

Two things:

1. Counts consecutive hang-like failures and, when they share a cause, cancels pi's remaining retries.
2. Prints a structured report of those failures.

## What this project does not do

It does not send extra requests. It does not rewrite payloads. A pull request that adds either of those will be asked to go through an issue first, because they change the cost and the safety story of what runs on a user's machine.

Please do not open issues or pull requests against [earendil-works/pi](https://github.com/earendil-works/pi) on this project's behalf. Upstream has its own contribution process.

## Setup

```bash
npm install
npm run check
```

There is no build. pi loads `extensions/retry-sentinel.ts` as TypeScript. `check` must pass against the published pi 1.6 types.

Behavior is configured with environment variables (`PI_RETRY_SENTINEL_MIN_FAILURES`, `PI_RETRY_SENTINEL_NO_STOP`, `PI_RETRY_SENTINEL_OFF`) and the `/retry-sentinel` command — see the README. Do not add a settings.json surface in a PR; that is a new feature.

## Reporting a bug

Open an issue with:

1. `pi --version`
2. The `retry-sentinel` output from the TUI notification or stderr
3. What you expected, and whether the provider was actually down

Redact API keys. Do not paste a full session JSONL.

## Commits

Imperative, one topic per commit: `fix: …`, `feat: …`, `docs: …`.
