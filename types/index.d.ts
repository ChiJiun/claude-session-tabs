export type Tab = { label: string; id: string }

export type Recent = Tab & { at: number }

export type Locale = 'zh-Hant' | 'zh-Hans' | 'ja' | 'en'

// 每個 session 自己回報的狀態：working 執行中、reply 要你回答才能繼續、review 跑完了等你查看；
// waiting 是舊版的寫法，當成 review。v 是寫入時的 mod 版本
export type SessionStatus = {
  state: 'working' | 'reply' | 'review' | 'waiting'
  at: number
  label?: string
  v?: string
}

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
