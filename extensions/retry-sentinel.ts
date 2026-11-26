/**
 * pi-retry-sentinel
 *
 * Watches consecutive hang-like failures in a pi session.
 *
 * When the last N failures share one signature, it cancels the remaining
 * retries — sending the same payload into the same wall again will not
 * produce a different result — and, when the run ends, prints a short
 * attempt history instead of one line of "Request timed out".
 *
 * This extension never sends an extra request and never rewrites a payload.
 *
 * Counting survives pi's retry because every retry is a new low-level run
 * (`agent_start` fires again). The counter resets only on a successful
 * reply or a new user prompt (`before_agent_start`).
 */

import type { AssistantMessage } from "@earendil-works/pi-ai";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";

interface FailureRecord {
	/** Error text with durations blanked, so "aborted (20)" equals "aborted (35)". */
	signature: string;
	errorMessage: string;
	durationMs: number;
}

function envCount(name: string, fallback: number, min: number): number {
	const raw = Number(process.env[name]);
	if (!Number.isFinite(raw) || raw < min) return fallback;
	return Math.floor(raw);
}

const DEFAULT_MIN_FAILURES = envCount("PI_RETRY_SENTINEL_MIN_FAILURES", 2, 2);
const DEFAULT_NO_STOP = process.env.PI_RETRY_SENTINEL_NO_STOP === "1";
const DISABLED = process.env.PI_RETRY_SENTINEL_OFF === "1";

function signatureOf(errorMessage: string): string {
	return errorMessage
		.replace(/\d+(\.\d+)?\s*(ms|s|sec|seconds|min)\b/gi, "<duration>")
		.replace(/\(\d+\)/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Only hang-like failures join the count.
 *
 * Rate limits, quota and context overflow already have a path in pi
 * (native retry and compaction). Counting them here would turn a normal
 * 429 backoff into a fake "same-cause hang".
 */
const EXCLUDED =
	/\b(?:429|too many requests|rate.?limit|insufficient_quota|quota exceeded|out of budget|billing|GoUsageLimitError|FreeUsageLimitError)\b/i;
const OVERFLOW =
	/prompt (?:is )?too long|context window exceeded|exceeds the context window|request_too_large|maximum context length|too many tokens|token limit exceeded/i;
const HANG_LIKE =
	/timed?\s*out|operation was aborted|timeout|\beconn|\bsocket\b|\bnetwork\b|fetch failed|ECONNRESET|ETIMEDOUT|EPIPE/i;

function isHangLike(errorMessage: string): boolean {
	if (EXCLUDED.test(errorMessage)) return false;
	if (OVERFLOW.test(errorMessage)) return false;
	return HANG_LIKE.test(errorMessage);
}

function isSameCause(failures: FailureRecord[], n: number): boolean {
	const recent = failures.slice(-n);
	return (
		recent.length === n &&
		recent.every((f) => f.signature === recent[0].signature)
	);
}

export default function retrySentinel(pi: ExtensionAPI): void {
	if (DISABLED) return;

	// Environment variables are the defaults. `/retry-sentinel` overrides
	// them for the current session.
	let minFailures = DEFAULT_MIN_FAILURES;
	let noStop = DEFAULT_NO_STOP;

	let failures: FailureRecord[] = [];
	let runStartAt = 0;
	let stoppedByUs = false;
	let currentCtx: ExtensionContext | undefined;

	/** TUI gets a notify; print and JSON get stderr. Never both. */
	function report(text: string): void {
		if (currentCtx?.hasUI) currentCtx.ui?.notify(text, "error");
		else console.error(`[retry-sentinel] ${text}`);
	}

	pi.registerCommand("retry-sentinel", {
		description: "Show or change retry-sentinel (threshold, early stop)",
		getArgumentCompletions: (prefix) => {
			const options = ["status", "min", "stop", "resume"];
			const matches = options.filter((option) => option.startsWith(prefix));
			return matches.length > 0
				? matches.map((option) => ({ value: option, label: option }))
				: null;
		},
		handler: async (args, ctx) => {
			const [sub, value] = args.trim().split(/\s+/);
			switch (sub) {
				case "min": {
					const next = Number(value);
					if (!Number.isFinite(next) || next < 2) {
						ctx.ui.notify(
							"Usage: /retry-sentinel min <n>  (n >= 2)",
							"warning",
						);
						return;
					}
					minFailures = Math.floor(next);
					ctx.ui.notify(`Same-cause threshold: ${minFailures}`, "info");
					return;
				}
				case "stop":
					noStop = false;
					ctx.ui.notify("Early stop: on", "info");
					return;
				case "resume":
					noStop = true;
					ctx.ui.notify("Early stop: off (report only)", "info");
					return;
				default: {
					const last = failures.at(-1);
					const lines = [
						`Early stop: ${noStop ? "off" : "on"}`,
						`Same-cause threshold: ${minFailures}`,
						`Failures this prompt: ${failures.length}`,
					];
					if (last) {
						lines.push(
							`Last failure: ${(last.durationMs / 1000).toFixed(1)}s — ${last.errorMessage.slice(0, 80)}`,
						);
					}
					lines.push("Commands: /retry-sentinel min <n> · stop · resume");
					ctx.ui.notify(lines.join("\n"), "info");
				}
			}
		},
	});

	pi.on("session_start", (_event, ctx) => {
		currentCtx = ctx;
	});

	pi.on("agent_start", (_event, ctx) => {
		currentCtx = ctx;
		runStartAt = runStartAt || Date.now();
	});

	pi.on("before_agent_start", () => {
		failures = [];
		runStartAt = 0;
		stoppedByUs = false;
	});

	pi.on("message_end", (event, ctx) => {
		currentCtx = ctx;
		const message = event.message as Partial<AssistantMessage> | undefined;
		if (message?.role !== "assistant") return;
		if (message.stopReason !== "error") {
			failures = [];
			return;
		}
		const errorMessage = message.errorMessage;
		if (!errorMessage || !isHangLike(errorMessage)) return;

		failures.push({
			signature: signatureOf(errorMessage),
			errorMessage,
			durationMs: message.durationMs ?? 0,
		});

		if (noStop || stoppedByUs) return;
		if (!isSameCause(failures, minFailures)) return;

		stoppedByUs = true;
		ctx.abort();
		report(
			`Stopped after ${failures.length} same-cause timeouts. Remaining retries cancelled.`,
		);
	});

	pi.on("agent_settled", (event, ctx) => {
		currentCtx = ctx;
		if (failures.length === 0) return;
		// A user Escape is not our report's business. Our own abort is.
		if (event.aborted && !stoppedByUs) return;

		const branch = ctx.sessionManager?.getBranch() ?? [];
		const last = branch.at(-1) as
			| { message?: { stopReason?: string } }
			| undefined;
		const endedInError = last?.message?.stopReason === "error";
		if (!endedInError && !stoppedByUs) return;

		const seconds = runStartAt > 0 ? (Date.now() - runStartAt) / 1000 : 0;
		const lines = [
			`${failures.length} timeout-like failure${failures.length === 1 ? "" : "s"} in ${seconds.toFixed(1)}s`,
		];

		const bySignature = new Map<string, number>();
		for (const f of failures) {
			bySignature.set(f.signature, (bySignature.get(f.signature) ?? 0) + 1);
		}
		for (const [signature, count] of bySignature) {
			lines.push(`${count} × ${signature}`);
		}
		for (const f of failures) {
			lines.push(
				`${(f.durationMs / 1000).toFixed(1)}s — ${f.errorMessage.slice(0, 140)}`,
			);
		}

		if (stoppedByUs) {
			lines.push(
				`Stopped early: ${failures.length} failures share one signature. Remaining retries were cancelled.`,
			);
		} else if (isSameCause(failures, minFailures)) {
			lines.push(
				`Same cause: the last ${minFailures} failures share one signature. This is not jitter — look at the gateway or the request payload.`,
			);
		} else {
			lines.push(
				"Mixed causes: the failures do not share one signature. Read the per-attempt lines above.",
			);
		}

		report(lines.join("\n"));
	});
}
