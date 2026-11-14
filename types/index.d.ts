export type Tab = { label: string; id: string }

export type Recent = Tab & { at: number }

export type Locale = 'zh-Hant' | 'zh-Hans' | 'ja' | 'en'

// 每個 session 自己回報的狀態：working 執行中、waiting 等你回覆
export type SessionStatus = { state: 'working' | 'waiting'; at: number; label?: string }

declare module 'claude-code' {
  interface PluginState {
    'session-tabs': {
      pinned: Tab[]
      recent: Recent[]
      status: Record<string, SessionStatus>
      locale: Locale
      isEditing: boolean
    }
  }
}
