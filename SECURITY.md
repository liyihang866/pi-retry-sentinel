# Security Policy

pi-retry-insight reads environment variables and emits diagnostics. It does not:

- write files
- make network requests
- read session contents beyond the last assistant message for the settled check
- execute tools

## Reporting

Use GitHub private security advisories on this repo, not public issues, for anything that looks like credential leakage or arbitrary code execution.

Nothing else here is a security boundary. This extension does not protect you from a malicious provider.
