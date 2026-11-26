# pi-retry-insight

[![pi-package](https://img.shields.io/badge/pi-package-blue)](https://pi.dev/packages)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

pi 扩展：连续同因超时时，把"一行 `Request timed out`"换成结构化摘要。

**v0.1.0 只做诊断**：不发额外请求、不改请求载荷、不碰 pi 的重试次数。

## 它解决什么

pi 超时/挂死后原样重试，最后只报最后一帧错误。几次尝试、每次多久、是不是同一个错、该查网关还是查载荷——都得自己翻 session 文件。

retry-insight 在最终失败时补一份摘要：

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

TUI 走 notify；`-p` / json 模式走 stderr（那是唯一出口）。

## 不做什么（v0.1.0 边界）

- 不发探活请求（那是下一版的事，先攒数据）
- 不改载荷、不丢图
- 不取消/削减 pi 自己的重试
- 429 / 配额 / 上下文溢出不进计数（pi 自己有重试和 compaction）

## 安装

前提：pi 1.6+。运行时零依赖。

```bash
pi install git:github.com/liyihang866/pi-retry-insight
# 临时试一次
pi -e git:github.com/liyihang866/pi-retry-insight
```

## 配置

| 变量 | 默认 | 说明 |
|---|---|---|
| `PI_RETRY_INSIGHT_MIN_FAILURES` | `2` | 摘要里标"同因"的连续失败数（下限 2） |
| `PI_RETRY_INSIGHT_OFF=1` | 关 | 完全关闭 |

## 同因怎么判

错误文本剥掉时长数字后取签名。`Request timed out: aborted (20)` 和 `Request timed out: aborted (35)` 是同签名；`ECONNRESET` 和 `timeout` 不是。

连续 ≥ `MIN_FAILURES` 次同签名超时类错误 → verdict 标 same-cause。成功回复或新 prompt 清零。

## License

MIT
