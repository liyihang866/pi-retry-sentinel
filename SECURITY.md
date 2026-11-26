# Security Policy

## What this extension does

pi-retry-sentinel reads three environment variables and listens to pi extension events. When consecutive hang-like failures share a cause it aborts the run and emits a diagnostic summary.

## What it never does

- Makes network requests
- Writes files
- Executes tools
- Reads API keys or session payloads
- Changes request bodies

## Reporting a vulnerability

If you find something that looks like credential leakage, arbitrary code execution, or a way this extension could be tricked into a network call, open a GitHub private security advisory. Do not open a public issue.

For anything else, a regular issue is fine. This extension is not a security boundary and does not protect you from a malicious model provider.
