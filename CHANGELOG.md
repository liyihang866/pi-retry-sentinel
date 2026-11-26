# Changelog

## [0.1.0] - 2026-11-25

### New Features

- Same-cause timeout insight: after consecutive identical timeout-like errors, emit a structured summary (attempts, wall-clock, per-attempt errors, same-cause verdict, hint) on final failure.
- TUI via `ui.notify`; print/json via stderr. No duplicate output.
- Flags: `PI_RETRY_INSIGHT_MIN_FAILURES`, `PI_RETRY_INSIGHT_OFF`.
- Excluded from counting: 429/rate-limit/quota, context overflow (pi handles those with its own retry/compaction).

### Not in this version

- Liveness probe (extra 1-token request) — planned after real-traffic data.
- Drop-images payload rewrite — depends on the probe.
