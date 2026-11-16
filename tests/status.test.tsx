import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const HERE = 'local_11111111-1111-1111-1111-111111111111'
const OTHER = 'local_22222222-2222-2222-2222-222222222222'

const BAND = {
  plugin: 'session-tabs',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 3,
    bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 2 },
    view: {},
  },
} as const

// 每個測試開頭引擎都要重新載入 mod，機器忙時光載入就可能超過預設的 5 秒。
// 慢的是引擎載入，與 mod 邏輯無關（mod 的 session.start 約 60 ms），不要調回去
const SLOW = { timeoutMs: 30000 }

// 模擬 desktop 環境與共用 store；回傳 store 內容讓測試檢查
const desktop = (on: On, seed: Record<string, unknown> = {}) => {
  const store: Record<string, unknown> = { ...seed }
  const env: Record<string, string> = {
    CLAUDE_CODE_ENTRYPOINT: 'claude-desktop',
    CLAUDE_CODE_HOST_SESSION_ID: HERE,
    OS: 'Windows_NT',
  }
  on('env.get', (_, e) => ({ value: env[e.name] }))
  on('store.get', (_, e) => ({ value: store[e.key] }))
  on('store.set', (_, e) => {
    store[e.key] = e.value
    return { value: undefined }
  })
  on('store.delete', (_, e) => {
    delete store[e.key]
    return { value: undefined }
  })
  on('session.root', () => ({ value: '/work/my-project' }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.complete', () => ({ text: '' }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('tool.call', () => ({ result: {} }))
  return store
}

const statusOf = (store: Record<string, unknown>) =>
  (store.status as Record<string, { state: string; v?: string }> | undefined)?.[HERE]

const turn = (answer: string, extra: Record<string, unknown> = {}) =>
  ({ answer, durationMs: 1, isAborted: false, turnId: 't', reason: 'answer', ...extra }) as never

test('一般回合結束算需要查看，結尾問句算需要回覆', SLOW, async ($, on) => {
  mock.clock(on)
  const store = desktop(on)
  await $.session.start({ cwd: '/work/my-project', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await $.turn.complete(turn('做完了。'))
  expect(statusOf(store)?.state).toBe('review')
  expect(statusOf(store)?.v).toBe('0.4.4')

  await $.turn.complete(turn('要用哪個方案？'))
  expect(statusOf(store)?.state).toBe('reply')
  await ui.unmount()
})

test('wrap_up 帶 blocked 問題算需要回覆，沒 blocked 算需要查看', SLOW, async ($, on) => {
  mock.clock(on)
  const store = desktop(on)
  await $.session.start({ cwd: '/work/my-project', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'r', ask: '要合併嗎？', blocked: true } as never)
  await $.turn.complete(turn('好了'))
  expect(statusOf(store)?.state).toBe('reply')

  await $.prompt.submit({ text: '繼續' } as never)
  await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'r', ask: '要不要順便改？' } as never)
  await $.turn.complete(turn('要不要順便改？'))
  expect(statusOf(store)?.state).toBe('review')
  await ui.unmount()
})

test('子代理的回合不改狀態，中斷的回合清掉狀態', SLOW, async ($, on) => {
  mock.clock(on)
  const store = desktop(on)
  await $.session.start({ cwd: '/work/my-project', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await $.prompt.submit({ text: '開始' } as never)
  expect(statusOf(store)?.state).toBe('working')
  await $.turn.complete(turn('子代理的報告？', { agentId: 'a1' }))
  expect(statusOf(store)?.state).toBe('working')

  await $.turn.complete(turn('', { isAborted: true, reason: 'aborted' }))
  expect(statusOf(store)).toBeUndefined()
  await ui.unmount()
})

test('其他 session 的狀態分成需要回覆與需要查看兩區，定時重讀會更新', SLOW, async ($, on) => {
  const clock = mock.clock(on)
  const store = desktop(on, {
    recent: [{ id: OTHER, label: 'other-project', at: 0 }],
  })
  await $.session.start({ cwd: '/work/my-project', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /需要|Needs/ })).toBeUndefined()

  // 別的 session 寫入需要回覆，不用這個 session 有新對話，下一次定時重讀就出現
  store.status = { [OTHER]: { state: 'reply', at: await clock.now(), label: 'other-project' } }
  await clock.advance(3000)
  expect((await ui.find({ type: 'Text', text: /Needs reply|需要回覆|返信|需要回复/ }))?.text).toBeTruthy()

  store.status = { [OTHER]: { state: 'review', at: await clock.now(), label: 'other-project' } }
  await clock.advance(3000)
  expect((await ui.find({ type: 'Text', text: /To review|需要查看|確認待ち/ }))?.text).toBeTruthy()
  await ui.unmount()
})

// 模擬使用者在 desktop 輸入框打的指令
const slash = (args = '') =>
  ({ args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } }) as const

const pinnedIds = (store: Record<string, unknown>) => ((store.pinned as { id: string }[] | undefined) ?? []).map(t => t.id)

test('/tabs-remove 不給名稱就移除目前 session 的釘選', SLOW, async ($, on) => {
  mock.clock(on)
  const store = desktop(on, {
    pinned: [
      { id: HERE, label: 'my-project' },
      { id: OTHER, label: 'other-project' },
    ],
  })
  await $.session.start({ cwd: '/work/my-project', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  const first = await $.command.run({ command: 'tabs-remove', ...slash() })
  expect(first.text).toContain('Removed "my-project"')
  expect(pinnedIds(store)).toEqual([OTHER])

  const again = await $.command.run({ command: 'tabs-remove', ...slash('  ') })
  expect(again.text).toContain('not pinned')
  expect(pinnedIds(store)).toEqual([OTHER])

  // 給名稱的用法不變
  const byName = await $.command.run({ command: 'tabs-remove', ...slash('other-project') })
  expect(byName.text).toContain('Removed "other-project"')
  expect(pinnedIds(store)).toEqual([])
  await ui.unmount()
})

test('/tabs-remove 不給名稱、又沒有 desktop session id 時提示改用名稱', SLOW, async ($, on) => {
  mock.clock(on)
  const store = desktop(on, { pinned: [{ id: HERE, label: 'my-project' }] })
  await $.session.start({ cwd: '/work/my-project', surface: 'terminal', isInteractive: true })

  // 沒畫過 desktop 的輸入框，不採用環境變數裡的 id
  const result = await $.command.run({ command: 'tabs-remove', ...slash() })
  expect(result.text).toContain('/tabs-remove <name>')
  expect(pinnedIds(store)).toEqual([HERE])
})
