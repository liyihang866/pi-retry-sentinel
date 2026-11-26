# pi-retry-insight

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![pi-package](https://img.shields.io/badge/pi-package-1.6%2B-blue)](https://pi.dev/packages)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-brightgreen)](package.json)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-ff69b4.svg)](CONTRIBUTING.md)

**pi 扩展：连续同因超时时，把"一行 `Request timed out`"换成结构化摘要。**

**v0.1.0 只做诊断** — 不发额外请求、不改请求载荷、不碰 pi 的重试次数。

English below · 中文为主

---

## The problem

When a pi request times out, pi retries the exact same payload and finally prints one line:

```
Request timed out.: This operation was aborted (20)
```

You get no attempt count, no per-attempt timing, no "is this the same error four times?", and no hint whether to blame the gateway or the payload. You end up reading the session JSONL by hand.

## What you get

On final failure, after ≥2 consecutive timeout-like errors with the same signature:

```
retry-insight: 4 consecutive timeout-like failure(s) in 38.1s
  ×4 Request timed out.: This operation was aborted
  - 6.0s  Request timed out.: This operation was aborted (20)
  - 6.0s  Request timed out.: This operation was aborted (20)
  - 6.0s  Request timed out.: This operation was aborted (20)
  - 6.0s  Request timed out.: This operation was aborted (20)
  verdict: same-cause (≥2 identical signatures) — likely not transient jitter; check the provider/gateway or the request payload
  hint: if this is an image/large-payload hang with the gateway otherwise alive, try removing recent images or switching model
```

TUI: `ui.notify`. Print / JSON mode: stderr (the only outlet there).

## Install

Requires pi 1.6+. Zero runtime dependencies.

```bash
pi install git:github.com/liyihang866/pi-retry-insight

# try once without saving to settings
pi -e git:github.com/liyihang866/pi-retry-insight
```

## Configure

| Variable | Default | Meaning |
|---|---|---|
| `PI_RETRY_INSIGHT_MIN_FAILURES` | `2` | Consecutive same-signature failures to mark "same-cause" (min 2) |
| `PI_RETRY_INSIGHT_OFF=1` | off | Disable entirely |

## How "same-cause" works

Error text is stripped of duration numbers into a signature. `Request timed out: aborted (20)` and `Request timed out: aborted (35)` share a signature; `ECONNRESET` and `timeout` do not.

Counted: timeout / aborted / ECONN* / fetch failed / socket / network.
Not counted (pi already handles these elsewhere): 429, rate limit, quota, billing, context overflow.

Counter resets on a successful reply or a new user prompt.

## What this does NOT do (v0.1.0)

- No liveness probe (planned after real-traffic data)
- No payload rewrite, no image drop
- Does not cancel or shorten pi's own retry
- Quiet when everything works — zero extra output

## Development

```bash
npm install
npm run check   # tsc --noEmit against pi 1.6 types
```

Scenario matrix lives in the pi-contrib workspace `testbed/` (fake upstream).

## License

[MIT](LICENSE)
