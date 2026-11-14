# claude-session-tabs

在 Claude desktop（Code 分頁）的輸入框上方加一排 session 快捷列，一鍵切換正在開發的 session。

- **需要回覆**：哪個 session 跑完一輪、或在等你回答問題，就會以「● 名稱」顯示在最前面，點了直接切過去。
- **釘選**：自己挑的常用 session，固定顯示。
- **最近**：最近送出過訊息的 session（最多顯示 6 個）。
- **所有 session 共用**：清單存在 Claude Code 的跨 session store，任何 session（包括舊的）載入 plugin 後都看得到同一排。
- **跟著 desktop 語言**：介面文字依 desktop 的語言設定切換（繁中、簡中、日文、英文）。

這是一個 Claude Code mod（使用 function hooks 的 plugin）。

## 安裝

在 Claude Code 終端機 session 裡：

```
/plugin install session-tabs --marketplace ChiJiun/claude-session-tabs
```

或在 shell：

```bash
claude plugin install session-tabs --marketplace ChiJiun/claude-session-tabs
```

或在 Claude desktop：輸入框旁的 **+** → **Plugins** → **Add marketplace**，填 `ChiJiun/claude-session-tabs` → 找到 `session-tabs` → **Add plugin**。

已經開著的 session 執行 `/reload-plugins` 就會載入。

## 使用方式

- 快捷列右邊的「編輯」按鈕：進入編輯模式後，釘選項目旁出現 ×（移出）、最近項目旁出現 ＋（加入釘選），也可以把目前這個 session 釘上或移除；按「完成」離開。
- 指令：
  - `/tabs-add [名稱]`：把目前 session 加入釘選（可自訂顯示名稱）
  - `/tabs-remove [名稱]`：從釘選移除（不給名稱就移除目前 session）
  - `/tabs-list`：列出釘選與最近的 session
- 點任一按鈕會用 `claude://claude.ai/epitaxy/<session id>` 連結切換到該 session。

## 運作方式

- 每個 session 在送出訊息時標記為「執行中」，一輪結束或呼叫 `AskUserQuestion` 時標記為「需要回覆」，結束時清掉狀態。
- 狀態寫進共用 store，其他 session 每 3 秒讀一次並重畫快捷列；超過 24 小時的狀態不顯示。
- desktop 會透過 `CLAUDE_CODE_HOST_SESSION_ID` 提供 session id；mod 只在自己確實畫在 desktop 上時才採用，避免子程序（例如 `claude -p`）誤記。

## 限制

- 只在 **Windows 上的 Claude desktop** 測試過。macOS（`open`）、Linux（`xdg-open`）的切換方式有寫但沒測。
- 終端機版 Claude Code 沒有 desktop session id，快捷列只會顯示提示，無法切換。
- 多個 session 同時寫入 store 時，可能有一方的更新被蓋掉（之後的寫入會再補上）。
- 「需要回覆」無法判斷你是否已經看過那個 session，只看最後一次狀態。
- 無法從 desktop 左側導覽列直接拖曳 session 進快捷列，請用編輯模式或 `/tabs-add`。

## 授權

MIT
