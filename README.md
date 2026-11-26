<div align="center">

# pi-retry-sentinel

**Stop burning retries on the same dead request.**

[![License: MIT](https://img.shields.io/github/license/liyihang866/pi-retry-sentinel)](LICENSE)
[![Release](https://img.shields.io/github/v/tag/liyihang866/pi-retry-sentinel?label=version)](https://github.com/liyihang866/pi-retry-sentinel/releases)
[![pi](https://img.shields.io/badge/works%20with-pi%201.6%2B-blue)](https://pi.dev)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-brightgreen)](package.json)

A [pi](https://github.com/earendil-works/pi) extension.

When two consecutive failures look like the same hang, cancel the rest of the retry budget and show what actually happened — instead of waiting out four 300-second timeouts for one line of `Request timed out`.

[Install](#install) · [What you see](#what-you-see) · [How it decides](#how-it-decides) · [Configuration](#configuration)

</div>

## Why

pi already retries timeouts. Two things it does not do:

1. **Stop when retrying is pointless.** The same payload, sent again into the same gateway, does not succeed because you waited another 300 seconds. That is wasted minutes and wasted tokens.
2. **Show the attempt history.** You get the last error and nothing else. Whether it failed four times the same way, recovered on attempt two, or was actually three different errors — that lives in the session file, which you then go read by hand.

This extension does both, and nothing else.

## What you see

While things work: nothing.

When the last two timeout-like failures share a signature, remaining retries are cancelled and you get:

```
[retry-sentinel] Stopped after 2 same-cause timeouts. Remaining retries cancelled.
[retry-sentinel] 2 timeout-like failures in 14.1s
2 × Request timed out.: This operation was aborted
6.0s — Request timed out.: This operation was aborted (20)
6.0s — Request timed out.: This operation was aborted (20)
Stopped early: 2 failures share one signature. Remaining retries were cancelled.
```

In the TUI this is a notification. In `--print` and JSON mode it goes to stderr.

If the failures do not match, pi keeps its normal retry. If you pressed Escape, or the run recovered — silence.

## How it decides

**What counts as a hang.** Assistant errors that look like timeouts or dead connections: `timeout`, `aborted`, `ECONN*`, socket, network, fetch failed.

**What does not.** Rate limits, quota, billing, context overflow. pi already has a retry path and a compaction path for those. Mixing a normal 429 backoff into this count would invent a hang that is not there.

**Same cause.** Durations are blanked into a signature, so `aborted (20)` and `aborted (35)` group together. `ECONNRESET` and `timeout` do not.

**Then it stops.** Confirmed same-cause → the run is aborted. The point is to not pay for attempts four, five, and six of a request that already died the same way twice.

**Counter reset.** A successful reply, or a new user prompt. Not on `agent_start` — in pi, every retry is a new low-level run, and resetting there would forget the previous attempts.

## Install

```bash
pi install npm:pi-retry-sentinel
# or
pi install git:github.com/liyihang866/pi-retry-sentinel
```

Try it once without saving it to settings:

```bash
pi -e npm:pi-retry-sentinel
```

Requires pi 1.6 or later. No runtime dependencies.

## Configuration

Defaults come from environment variables, read when pi starts — your shell, `~/.zshrc`, or whatever launcher starts pi.

```bash
# stop after 3 same-cause failures instead of 2
export PI_RETRY_SENTINEL_MIN_FAILURES=3

# do not cancel retries; only print the report
export PI_RETRY_SENTINEL_NO_STOP=1

# turn the extension off
export PI_RETRY_SENTINEL_OFF=1
```

| Variable | Default | Meaning |
| --- | --- | --- |
| `PI_RETRY_SENTINEL_MIN_FAILURES` | `2` | Same-signature failures before it stops. Minimum 2. |
| `PI_RETRY_SENTINEL_NO_STOP` | unset | `1` = keep pi's retries, only print the report. |
| `PI_RETRY_SENTINEL_OFF` | unset | `1` = extension off. |

### Slash command

In the TUI, `/retry-sentinel` changes the current session without touching env vars:

```
/retry-sentinel            status
/retry-sentinel min 3     same-cause threshold for this session
/retry-sentinel stop      early stop on (default)
/retry-sentinel resume    early stop off, report only
```

The command is a no-op in `--print` / JSON mode.

## What it will not do

- Send a probe request
- Rewrite the payload (drop images, shrink context, anything)
- Change `retry.maxRetries` in your settings — that stays yours

## Compatibility

Wherever pi loads extensions: TUI, `--print`, JSON, Orca.

Does not touch provider selection, tools, skills, or session format.

## Development

```bash
npm install
npm run check
```

`check` type-checks against the published pi 1.6 declaration files. There is no build; pi loads the TypeScript source.

## Origin

Out of a real incident: an image request into a gateway that hung, pi retried the identical 288 KB payload twelve times at 300 seconds each, and the only record was the session JSONL. This extension is the part of that problem a user-space extension can fix without sending extra requests or mutating payloads.

## License

[MIT](LICENSE)
