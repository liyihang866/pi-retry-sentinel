# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-11-25

### Added

- Early stop. After two consecutive timeout-like failures that share a signature, remaining retries are cancelled. The same payload is not going to teach anyone anything new. Disable with `PI_RETRY_SENTINEL_NO_STOP=1`.
- Same-cause report on the way out: attempt count, total time, per-attempt duration and error, and whether the failures share a signature.
- Signature normalization. Durations are blanked so `aborted (20)` groups with `aborted (35)`.
- `/retry-sentinel` command: status, session-scoped threshold, early-stop on/off.
- TUI output via `ui.notify`. `--print` and JSON output via stderr. Never both.
- `PI_RETRY_SENTINEL_MIN_FAILURES` (default 2, minimum 2), `PI_RETRY_SENTINEL_NO_STOP=1`, `PI_RETRY_SENTINEL_OFF=1`.
- Hang-like counting only. Rate limits, quota, billing and context overflow are ignored; pi already routes those through its own retry and compaction.

### Not included

- Liveness probe (an extra billed request)
- Payload rewriting (drop images, shrink context)

Those change the cost and safety story and are not in this release.

[Unreleased]: https://github.com/liyihang866/pi-retry-sentinel/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/liyihang866/pi-retry-sentinel/releases/tag/v0.1.0
