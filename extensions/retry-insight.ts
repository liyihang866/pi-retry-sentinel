/**
 * pi-retry-insight — pi extension (zero core changes)
 *
 * Same-cause timeout insight: count consecutive identical timeout-like errors
 * and, on final failure, emit a structured summary (attempts, wall-clock,
 * per-attempt errors, same-cause verdict, hint) instead of one line of
 * "Request timed out".
 *
 * v0.1.0 is diagnose-only: no extra billed request, no payload rewrite.
 * Probe + drop-images stay out of this version.
 *
 * 中文注释保留（维护者中文为主）。行为以本文件与 README 为准。
 *
 * 用法：pi -e ./extensions/retry-insight.ts
 * 配置（环境变量）：
 *   PI_RETRY_INSIGHT_MIN_FAILURES  摘要里标"同因"的连续失败数（默认 2，最低 2）
 *   PI_RETRY_INSIGHT_OFF=1         完全关闭
 */

import type { AssistantMessage } from "@earendil-works/pi-ai";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";

/** 连续失败记录（跨重试 run 保持，新用户 prompt 才清零）。 */
interface FailureRecord {
	/** 规整后的错误签名（剥时长等数字）。 */
	signature: string;
	/** 原始错误文本。 */
	errorMessage: string;
	/** 该次尝试耗时 ms。 */
	durationMs: number;
	/** 失败时刻（epoch ms）。 */
	at: number;
}

const MIN_FAILURES = Math.max(
	2,
	Number(process.env.PI_RETRY_INSIGHT_MIN_FAILURES) || 2,
);
const DISABLED = process.env.PI_RETRY_INSIGHT_OFF === "1";

/** 超时类错误抽签名：剥掉内嵌数字/秒数，只留类别前缀。 */
function signatureOf(errorMessage: string): string {
	return errorMessage
		.replace(/[0-9]+(\.\d+)?\s*(ms|s|sec|seconds|min)/gi, "<t>")
		.replace(/\(\d+\)/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

/** 仅超时/挂死类错误参与（429/配额/上下文溢出走 pi 自己的重试或 compaction，不掺和）。 */
function isTimeoutLike(errorMessage: string): boolean {
	// 配额/限流：pi 原生 retryable，不是"挂死"
	if (
		/\b(429|too many requests|rate.?limit|insufficient_quota|quota exceeded|out of budget|billing|GoUsageLimitError|FreeUsageLimitError)\b/i.test(
			errorMessage,
		)
	)
		return false;
	// 上下文溢出：pi 走 compaction
	if (
		/prompt (?:is )?too long|context window exceeded|exceeds the context window|request_too_large|maximum context length|too many tokens|token limit exceeded/i.test(
			errorMessage,
		)
	)
		return false;
	return /timed?\s*out|operation was aborted|timeout|\beconn|\bsocket\b|\bnetwork\b|fetch failed|ECONNRESET|ETIMEDOUT|EPIPE/i.test(
		errorMessage,
	);
}

export default function retryInsight(pi: ExtensionAPI): void {
	if (DISABLED) return;

	// ---- prompt 级状态（before_agent_start 重置；重试是新 run，不能在 agent_start 清） ----
	let failures: FailureRecord[] = [];
	let runStartAt = 0;
	/** 最近的 ExtensionContext。 */
	let currentCtx: ExtensionContext | undefined;

	const note = (message: string, level: "info" | "warning" | "error"): void => {
		// TUI/RPC：只走 notify（console.error 在 fullscreen 会穿透 alt-screen）。
		// -p / json：notify 是 no-op，stderr 是唯一通道。
		if (currentCtx?.hasUI) currentCtx?.ui?.notify(message, level);
		else console.error(`[retry-insight] ${message}`);
	};

	pi.on("session_start", async (_event, ctx) => {
		currentCtx = ctx;
	});

	// 注意：pi 的每次重试都是一个新的低层 run（agent.continue() → agent_start），
	// 所以计数器不能在 agent_start 重置；只在"成功回复"或"新用户 prompt"时清零。
	pi.on("agent_start", async (_event, ctx) => {
		currentCtx = ctx;
		runStartAt = runStartAt || Date.now();
	});

	pi.on("before_agent_start", async () => {
		// 新的用户 prompt：全新场景，清零。
		failures = [];
		runStartAt = 0;
	});

	// ---- 数失败：只看 assistant 的 error 收尾；成功回复则清零 ----
	pi.on("message_end", async (event) => {
		const message = event.message;
		if (message.role !== "assistant") return;
		const assistant = message as AssistantMessage;
		if (assistant.stopReason !== "error") {
			failures = [];
			return;
		}
		if (!assistant.errorMessage) return;
		if (!isTimeoutLike(assistant.errorMessage)) return;

		failures.push({
			signature: signatureOf(assistant.errorMessage),
			errorMessage: assistant.errorMessage,
			durationMs: assistant.durationMs ?? 0,
			at: Date.now(),
		});
	});

	// ---- 结构化摘要：run 收尾、确实以错误收场时输出 ----
	pi.on("agent_settled", async (event, ctx) => {
		currentCtx = ctx;
		if (failures.length === 0) return;
		const entries = ctx.sessionManager?.getBranch() ?? [];
		const lastMessage = entries.at(-1);
		const endedWithError =
			lastMessage?.type === "message" &&
			(lastMessage as { message?: { role?: string; stopReason?: string } })
				.message?.role === "assistant" &&
			(lastMessage as { message: { stopReason: string } }).message
				.stopReason === "error";
		if (!endedWithError || event.aborted) return;

		const totalMs = runStartAt > 0 ? Date.now() - runStartAt : 0;
		const lines: string[] = [];
		lines.push(
			`retry-insight: ${failures.length} consecutive timeout-like failure(s) in ${(totalMs / 1000).toFixed(1)}s`,
		);
		const bySignature = new Map<string, number>();
		for (const f of failures)
			bySignature.set(f.signature, (bySignature.get(f.signature) ?? 0) + 1);
		for (const [sig, count] of bySignature)
			lines.push(`  ×${count} ${sig}`);
		for (const f of failures) {
			lines.push(
				`  - ${(f.durationMs / 1000).toFixed(1)}s  ${f.errorMessage.slice(0, 120)}`,
			);
		}
		const recent = failures.slice(-MIN_FAILURES);
		const sameCause =
			recent.length === MIN_FAILURES &&
			recent.every((f) => f.signature === recent[0].signature);
		if (sameCause) {
			lines.push(
				`  verdict: same-cause (≥${MIN_FAILURES} identical signatures) — likely not transient jitter; check the provider/gateway or the request payload`,
			);
		} else {
			lines.push("  verdict: mixed causes — see per-attempt lines above");
		}
		lines.push(
			"  hint: if this is an image/large-payload hang with the gateway otherwise alive, try removing recent images or switching model",
		);
		note(lines.join("\n"), "error");
	});
}
