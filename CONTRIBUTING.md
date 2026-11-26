# Contributing

Thanks for looking at pi-retry-insight. Keep it small.

## Ground rules

- v0.1.x is **diagnose-only**: no extra billed requests, no payload rewrite. If you want probe / drop-images, open an issue first — that is the v0.2 conversation, not a drive-by PR.
- Do not open issues or PRs against [earendil-works/pi](https://github.com/earendil-works/pi) on this project's behalf. Upstream has its own contribution rules (human-written, lgtm-gated).
- One extension file (`extensions/retry-insight.ts`). No build step. No runtime deps.

## Dev

```bash
npm install
npm run check
```

Type-checks against the published `@earendil-works/pi-*` 1.6 types via peerDependencies.

## Commit style

Imperative, one topic per commit: `fix: ...`, `feat: ...`, `docs: ...`.

## Reporting a bug

Open an issue with:

1. pi version (`pi --version`)
2. The `[retry-insight]` block from TUI notify or stderr
3. What you expected vs what happened
4. Whether the provider was actually down (so we can tell misdiagnosis from correct diagnosis)

Do not paste API keys or full session JSONL. Redact.
