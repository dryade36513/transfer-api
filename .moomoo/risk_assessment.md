# 防禦性評估 · Risk Assessment

> 掃描時間：2026-06-22

## ELI5 類比

這個專案像一個「**對外開放的翻譯窗口**」：
- 好處：方便、快速、能藏住真正的 upstream key。
- 風險：若窗口沒上鎖（沒設 `WORKER_API_KEY`），任何人都能用你的 upstream 配額；而 upstream 本身（unlimited.surf）也有社群回報的安全疑慮。

---

## 🔴 高風險

### 1. 上游服務信任問題
- **現象**：README 明確警告 unlimited.surf 可能有投毒行為，不建議接入有電腦控制權的 agent（如 Claude Code）。
- **影響**：模型回應可能包含惡意指令；若 agent 有檔案/終端機權限，後果嚴重。
- **建議**：
  - 僅用於**唯讀對話**場景（如 Cherry Studio）。
  - 不要將此 Worker 接入具 **tool use / MCP / 檔案寫入** 能力的 agent。
  - 考慮更換可信的上游 provider。

### 2. 未設定 WORKER_API_KEY 時的開放存取
- **現象**：`validateWorkerApiKey()` 在無 `WORKER_API_KEY` 時直接放行。
- **影響**：Worker URL 一旦外洩，他人可濫用你的 upstream 配額。
- **建議**：**務必設定** `WORKER_API_KEY`；考慮加 Cloudflare Access 或 IP 限制。

### 3. CORS 全開放 (`Access-Control-Allow-Origin: *`)
- **現象**：任何網站的前端 JS 都可跨域呼叫此 Worker。
- **影響**：若 Worker key 被嵌入前端，極易外洩。
- **建議**：API key 僅用於後端；若需瀏覽器端呼叫，改用 Cloudflare Access 或限制 Origin。

---

## 🟡 中風險

### 4. 協議適配不完整（功能降級）
- **現象**：
  - Tool calling / function calling 未完整實作（僅將 tools 序列化進 prompt 文字）。
  - Vision / 圖片理解僅轉為 `[image attached]` 占位符。
  - Embeddings、Audio、Images 直接回 501。
- **影響**：部分 OpenAI/Anthropic SDK 功能靜默失效或行為異常。
- **建議**：在文件或 `/health` 端點明確列出「不支援清單」；客戶端做 capability 檢測。

### 5. Token 用量為估算值
- **現象**：`estimateTokens()` 用 `字元數 / 4` 粗估，非真實 tokenizer。
- **影響**：`/v1/*` 回應中的 `usage` 欄位不準確，影響計費監控。
- **建議**：若需精確計費，應從上游 SSE 事件讀取真實 usage（若 upstream 有提供）。

### 6. 單檔 monolith（1160 行 worker.js）
- **現象**：所有邏輯集中一檔，無測試、無型別。
- **影響**：修改任一適配邏輯可能意外破壞其他路由；難以回歸測試。
- **建議**：未來可拆分為 `routes/`, `adapters/`, `upstream/` 模組；加 wrangler vitest 測試。

### 7. 無持久化檔案儲存
- **現象**：OpenAI Files API 僅 stub（上傳後立即 extract，無法 GET 取回）。
- **影響**：依賴 OpenAI Files 流程的工具（如 Assistants）無法正常運作。
- **建議**：若需此功能，綁定 Cloudflare R2 或 KV。

---

## 🟢 低風險 / 已做得好的部分

| 項目 | 說明 |
|------|------|
| API Key 不進 Git | `.gitignore` 排除 `.env`、`.dev.vars`；README 強調用 Secret |
| 常數時間比對 | `constantTimeEqual()` 防止 timing attack |
| 上游 key 隔離 | 客戶端 key 與 upstream key 分離（雙 key 模式） |
| 錯誤處理 | 統一 `errorResponse()` 格式 |
| 上游失敗 fallback | 模型列表有內建 fallback catalog |

---

## 行動建議優先序

1. **立即**：設定 `WORKER_API_KEY`；不要接入高權限 agent。
2. **短期**：評估是否更換 upstream；限制 CORS Origin。
3. **中期**：拆分模組、加整合測試。
4. **長期**：若需 Files/持久化，接入 R2；完善 tool calling 適配。
