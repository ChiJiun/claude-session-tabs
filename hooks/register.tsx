import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Locale, Recent, SessionStatus, Tab } from '../types'

const pinned = atom({ plugin: 'session-tabs', key: 'pinned' } as const, [] as Tab[])
const recent = atom({ plugin: 'session-tabs', key: 'recent' } as const, [] as Recent[])
const status = atom({ plugin: 'session-tabs', key: 'status' } as const, {} as Record<string, SessionStatus>)
const locale = atom({ plugin: 'session-tabs', key: 'locale' } as const, 'en' as Locale)
const isEditing = atom({ plugin: 'session-tabs', key: 'isEditing' } as const, false)

const MAX_RECENT = 10
const SHOWN_RECENT = 6
const POLL_MS = 3000
const PLACEHOLDER = '…'
const STALE_MS = 24 * 60 * 60 * 1000
// 寫進每個 session 的狀態，看得出哪些 session 還沒 /reload-plugins 載入新版
const VERSION = '0.4.4'

const STRINGS = {
  'zh-Hant': {
    pinned: '釘選：',
    recent: '最近：',
    empty: '還沒有其他 session。在別的 session 送出訊息後就會出現在這裡。',
    edit: '編輯',
    done: '完成',
    pinHere: '＋釘選這個 session',
    unpinHere: '取消釘選這個 session',
    waiting: '需要回覆：',
    review: '需要查看：',
    untitled: '（未命名）',
    working: '執行中',
    addDesc: '把目前的 session（或指定 id）釘選到快捷列',
    addHint: '[名稱] [local_… session id]',
    removeDesc: '從快捷列移除釘選的 session（不給名稱就移除目前這個）',
    removeHint: '[名稱]',
    listDesc: '列出快捷列上的 session',
    noHost: '這個 session 不是由 desktop app 開的，無法取得 session id。請改用 /tabs-add <名稱> <local_… id>。',
    added: (l: string) => `已釘選「${l}」。`,
    removed: (l: string) => `已移除「${l}」。`,
    notFound: (l: string) => `找不到「${l}」。`,
    notPinnedHere: '目前這個 session 沒有釘選。',
    removeNoHost: '這個 session 不是由 desktop app 開的，無法取得 session id。請改用 /tabs-remove <名稱>。',
    listPinned: '釘選',
    listRecent: '最近使用',
    none: '（無）',
    openFailed: (l: string, r: string) => `開不了「${l}」：${r}`,
  },
  'zh-Hans': {
    pinned: '置顶：',
    recent: '最近：',
    empty: '还没有其他 session。在别的 session 发送消息后就会出现在这里。',
    edit: '编辑',
    done: '完成',
    pinHere: '＋置顶这个 session',
    unpinHere: '取消置顶这个 session',
    waiting: '需要回复：',
    review: '需要查看：',
    untitled: '（未命名）',
    working: '运行中',
    addDesc: '把当前 session（或指定 id）置顶到快捷栏',
    addHint: '[名称] [local_… session id]',
    removeDesc: '从快捷栏移除置顶的 session（不给名称就移除当前这个）',
    removeHint: '[名称]',
    listDesc: '列出快捷栏上的 session',
    noHost: '这个 session 不是由 desktop app 打开的，无法取得 session id。请改用 /tabs-add <名称> <local_… id>。',
    added: (l: string) => `已置顶「${l}」。`,
    removed: (l: string) => `已移除「${l}」。`,
    notFound: (l: string) => `找不到「${l}」。`,
    notPinnedHere: '当前这个 session 没有置顶。',
    removeNoHost: '这个 session 不是由 desktop app 打开的，无法取得 session id。请改用 /tabs-remove <名称>。',
    listPinned: '置顶',
    listRecent: '最近使用',
    none: '（无）',
    openFailed: (l: string, r: string) => `打不开「${l}」：${r}`,
  },
  ja: {
    pinned: 'ピン留め：',
    recent: '最近：',
    empty: 'ほかの session はまだありません。別の session でメッセージを送るとここに表示されます。',
    edit: '編集',
    done: '完了',
    pinHere: '＋この session をピン留め',
    unpinHere: 'この session のピン留めを外す',
    waiting: '返信待ち：',
    review: '確認待ち：',
    untitled: '（無題）',
    working: '実行中',
    addDesc: '今の session（または指定した id）をピン留めする',
    addHint: '[名前] [local_… session id]',
    removeDesc: 'ピン留めした session を外す（名前を省略すると今の session）',
    removeHint: '[名前]',
    listDesc: 'クイックバーの session を一覧表示',
    noHost: 'この session は desktop app から開かれていないため id を取得できません。/tabs-add <名前> <local_… id> を使ってください。',
    added: (l: string) => `「${l}」をピン留めしました。`,
    removed: (l: string) => `「${l}」を外しました。`,
    notFound: (l: string) => `「${l}」が見つかりません。`,
    notPinnedHere: 'この session はピン留めされていません。',
    removeNoHost: 'この session は desktop app から開かれていないため id を取得できません。/tabs-remove <名前> を使ってください。',
    listPinned: 'ピン留め',
    listRecent: '最近使った',
    none: '（なし）',
    openFailed: (l: string, r: string) => `「${l}」を開けません：${r}`,
  },
  en: {
    pinned: 'Pinned:',
    recent: 'Recent:',
    empty: 'No other sessions yet. Send a message in another session and it shows up here.',
    edit: 'Edit',
    done: 'Done',
    pinHere: '+ Pin this session',
    unpinHere: 'Unpin this session',
    waiting: 'Needs reply:',
    review: 'To review:',
    untitled: '(untitled)',
    working: 'working',
    addDesc: 'Pin this session (or a given id) to the quick bar',
    addHint: '[name] [local_… session id]',
    removeDesc: 'Unpin a session from the quick bar (this one when no name is given)',
    removeHint: '[name]',
    listDesc: 'List the sessions on the quick bar',
    noHost: 'This session was not started by the desktop app, so its id is unknown. Use /tabs-add <name> <local_… id> instead.',
    added: (l: string) => `Pinned "${l}".`,
    removed: (l: string) => `Removed "${l}".`,
    notFound: (l: string) => `"${l}" not found.`,
    notPinnedHere: 'This session is not pinned.',
    removeNoHost: 'This session was not started by the desktop app, so its id is unknown. Use /tabs-remove <name> instead.',
    listPinned: 'Pinned',
    listRecent: 'Recent',
    none: '(none)',
    openFailed: (l: string, r: string) => `Could not open "${l}": ${r}`,
  },
} as const

type Strings = (typeof STRINGS)[Locale]

const toLocale = (raw: unknown): Locale => {
  const value = typeof raw === 'string' ? raw.toLowerCase() : ''
  if (value.startsWith('zh')) {
    return /hans|cn|sg/.test(value) ? 'zh-Hans' : 'zh-Hant'
  }
  if (value.startsWith('ja')) {
    return 'ja'
  }
  return 'en'
}

// desktop app 把介面語言存在它的 config.json（"locale"）
const readDesktopLocale = async ($: EngineInterface): Promise<Locale> => {
  const candidates: string[] = []
  const localAppData = await $.env.get('LOCALAPPDATA')
  const appData = await $.env.get('APPDATA')
  const home = await $.env.get('HOME')
  if (localAppData) {
    try {
      for (const entry of await $.fs.list(`${localAppData}/Claude-Data`)) {
        candidates.push(`${localAppData}/Claude-Data/${entry.name}/config.json`)
      }
    } catch {
      // 沒有 MSIX 版的資料夾
    }
  }
  if (appData) {
    candidates.push(`${appData}/Claude/config.json`)
  }
  if (home) {
    candidates.push(`${home}/Library/Application Support/Claude/config.json`)
    candidates.push(`${home}/.config/Claude/config.json`)
  }
  for (const path of candidates) {
    try {
      const config = JSON.parse(await $.fs.read(path)) as { locale?: unknown }
      if (config.locale) {
        return toLocale(config.locale)
      }
    } catch {
      // 檔案不存在或讀不了，換下一個
    }
  }
  return 'en'
}

const linkOf = (id: string) => `claude://claude.ai/epitaxy/${id}`

// 依作業系統挑開啟 claude:// 連結的指令；app 內的 <Link> 點了不會交給系統處理
const openers = async ($: EngineInterface) =>
  (await $.env.get('OS')) === 'Windows_NT'
    ? [['rundll32', 'url.dll,FileProtocolHandler']]
    : [['open'], ['xdg-open']]

// desktop 給每個 session 的 id（local_…），session 開始時從環境變數讀一次。
// 它啟動的子程序（例如 claude -p）也會繼承這個變數，但子程序不會畫 desktop 畫面，
// 所以要等這個程序真的畫過 desktop 的輸入框，才把它當成這個 session 的 id。
let hostEnv = ''
let drawsDesktop = false
const currentId = () => (drawsDesktop ? hostEnv : '')

// 這一輪結束時要不要算「需要回覆」：desktop 的 wrap_up 帶 blocked 問題時為 true；
// usedWrapUp 表示這輪有 wrap_up，就不再用「結尾是問號」來猜
let askedBlocking = false
let usedWrapUp = false
// 正在等你允許工具，工具跑完就回到執行中
let awaitingAnswer = false

// desktop 預先開好、還沒指派的 session 與暫存資料夾，名稱沒有意義
const isScratch = (name: string) => /^(scratch|spare)-/.test(name)

const baseName = (path: string) => path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? path

const loadList = async <T,>($: EngineInterface, key: string): Promise<T[]> => {
  const saved = await $.store.get(key)
  return Array.isArray(saved) ? (saved as T[]) : []
}

const loadStatus = async ($: EngineInterface): Promise<Record<string, SessionStatus>> => {
  const saved = await $.store.get('status')
  return saved && typeof saved === 'object' ? (saved as Record<string, SessionStatus>) : {}
}

// 從 store 重讀所有 session 共用的資料，其他 session 的變更靠這個進來
const refresh = async ($: EngineInterface) => {
  const [tabs, recents, states] = await Promise.all([
    loadList<Tab>($, 'pinned'),
    loadList<Recent>($, 'recent'),
    loadStatus($),
  ])
  await update($, pinned, () => tabs)
  await update($, recent, () => recents)
  await update($, status, () => states)
}

// 這個 session 最好的顯示名稱：釘選的名稱 > 最近清單記的 > 專案資料夾名稱；暫存資料夾沒有名稱
const bestLabel = async ($: EngineInterface, id: string) => {
  const usable = (label: string | undefined) => label && label !== PLACEHOLDER && !isScratch(label)
  const fromPin = (await loadList<Tab>($, 'pinned')).find(t => t.id === id)?.label
  if (usable(fromPin)) {
    return fromPin
  }
  const fromRecent = (await loadList<Recent>($, 'recent')).find(r => r.id === id)?.label
  if (usable(fromRecent)) {
    return fromRecent
  }
  const folder = baseName(await $.session.root())
  return isScratch(folder) ? undefined : folder
}

const setStatus = async ($: EngineInterface, state: SessionStatus['state'] | undefined) => {
  const id = currentId()
  if (!id) {
    return
  }
  const states = await loadStatus($)
  if (state) {
    states[id] = { state, at: await $.clock.now(), label: await bestLabel($, id), v: VERSION }
  } else {
    delete states[id]
  }
  await $.store.set('status', states)
  await update($, status, () => states)
}

const markSeen = async ($: EngineInterface, id: string) => {
  const states = await loadStatus($)
  const st = states[id]
  if (!st || (st.state !== 'review' && st.state !== 'waiting')) {
    return
  }
  delete states[id]
  await $.store.set('status', states)
  await update($, status, () => states)
}

// 舊版只有 waiting 一種，當成需要查看
const kindOf = (st: SessionStatus | undefined) =>
  st?.state === 'reply' ? 'reply' : st?.state === 'review' || st?.state === 'waiting' ? 'review' : st?.state

// 送出訊息時把目前的 session 記到「最近」，最新的排最前面。
// 專案資料夾用資料夾名稱；暫存資料夾用第一則訊息的開頭。
const touch = async ($: EngineInterface, text: string) => {
  const id = currentId()
  if (!id) {
    return
  }
  const list = await loadList<Recent>($, 'recent')
  const existing = list.find(r => r.id === id)
  const folder = baseName(await $.session.root())
  const fromText = text.replace(/\s+/g, ' ').trim().slice(0, 14) || PLACEHOLDER
  const label = !isScratch(folder)
    ? folder
    : existing && existing.label !== PLACEHOLDER && !isScratch(existing.label)
      ? existing.label
      : fromText
  const now = await $.clock.now()
  const next = [{ id, label, at: now }, ...list.filter(r => r.id !== id)].slice(0, MAX_RECENT)
  await $.store.set('recent', next)
  await update($, recent, () => next)
}

const pin = async ($: EngineInterface, tab: Tab) => {
  const list = (await loadList<Tab>($, 'pinned')).filter(t => t.id !== tab.id && t.label !== tab.label)
  const next = [...list, tab]
  await $.store.set('pinned', next)
  await update($, pinned, () => next)
  return next
}

const unpin = async ($: EngineInterface, match: (t: Tab) => boolean) => {
  const list = await loadList<Tab>($, 'pinned')
  const next = list.filter(t => !match(t))
  await $.store.set('pinned', next)
  await update($, pinned, () => next)
  return { list, next }
}

// 目前 session 的名稱：最近清單裡記的，否則用資料夾名稱
const labelHere = async ($: EngineInterface, id: string) => {
  const known = (await read($, recent)).find(r => r.id === id)
  return known && known.label !== PLACEHOLDER ? known.label : baseName(await $.session.root())
}

const band = async ($: EngineInterface, e: Parameters<EngineInterface['ui']['resolve']>[0]) => {
  if (e.surface === 'desktop') {
    drawsDesktop = true
  }
  const s = STRINGS[await read($, locale)]
  const current = currentId()
  const editing = await read($, isEditing)
  const states = await read($, status)
  const allPinned = await read($, pinned)
  const isHerePinned = allPinned.some(t => t.id === current)
  const allRecent = await read($, recent)
  const now = await $.clock.now()

  // 需要回覆的 session（不含目前這個、超過一天沒動靜的不算），最新的排最前面
  const nameOf = (id: string) =>
    allPinned.find(t => t.id === id)?.label ??
    allRecent.find(r => r.id === id && r.label !== PLACEHOLDER && !isScratch(r.label))?.label ??
    states[id]?.label ??
    s.untitled
  const pending = (kind: 'reply' | 'review'): Tab[] =>
    editing
      ? []
      : Object.entries(states)
          .filter(([id, st]) => id !== current && kindOf(st) === kind && now - st.at < STALE_MS)
          .sort(([, a], [, b]) => b.at - a.at)
          .map(([id]) => ({ id, label: nameOf(id) }))
  const replies = pending('reply')
  const reviews = pending('review')
  const waitingIds = new Set([...replies, ...reviews].map(t => t.id))

  const tabs = allPinned.filter(t => t.id !== current && !waitingIds.has(t.id))
  const pinnedIds = new Set(allPinned.map(t => t.id))
  const recents = allRecent
    .filter(
      r =>
        r.id !== current &&
        !pinnedIds.has(r.id) &&
        !waitingIds.has(r.id) &&
        r.label !== PLACEHOLDER &&
        !isScratch(r.label),
    )
    .slice(0, SHOWN_RECENT)

  const { Box, Text, Button } = $.ui.resolve(e)

  // 需要回覆的 session 名稱前加 ●，執行中的加 …
  const labelOf = (t: Tab) => {
    const kind = kindOf(states[t.id])
    return kind === 'reply'
      ? `● ${t.label}`
      : kind === 'review'
        ? `○ ${t.label}`
        : kind === 'working'
          ? `… ${t.label}`
          : t.label
  }

  const open = async (t: Tab) => {
    try {
      await markSeen($, t.id)
    } catch {
      // 清不掉就留著，不影響切換
    }
    let reason = ''
    for (const argv of await openers($)) {
      try {
        const { exitCode, stderr } = await $.process.run([...argv, linkOf(t.id)])
        if (exitCode === 0) {
          return
        }
        reason = stderr.trim() || `exit ${exitCode}`
      } catch (error) {
        reason = String(error)
      }
    }
    $.ui.toast(s.openFailed(t.label, reason))
  }

  const toggleEdit = () => update($, isEditing, value => !value)

  const togglePinHere = async () => {
    if (isHerePinned) {
      await unpin($, t => t.id === current)
    } else {
      await pin($, { id: current, label: await labelHere($, current) })
    }
  }

  if (!editing && waitingIds.size === 0 && tabs.length === 0 && recents.length === 0) {
    return (
      <Box flexDirection="row" flexWrap="wrap" gap={1}>
        <Text dimColor>{s.empty}</Text>
        {current && <Button key="pin-here" label={s.pinHere} onPress={togglePinHere} />}
      </Box>
    )
  }

  return (
    <Box flexDirection="row" flexWrap="wrap" gap={1}>
      {replies.length > 0 && (
        <Text bold color="error">
          {s.waiting}
        </Text>
      )}
      {replies.map(t => (
        <Button key={`w-${t.id}`} label={`● ${t.label}`} onPress={() => open(t)} />
      ))}
      {reviews.length > 0 && (
        <Text bold color="suggestion">
          {s.review}
        </Text>
      )}
      {reviews.map(t => (
        <Button key={`v-${t.id}`} label={`○ ${t.label}`} onPress={() => open(t)} />
      ))}
      {tabs.length > 0 && <Text dimColor>{s.pinned}</Text>}
      {tabs.map(t =>
        editing ? (
          <Button key={`x-${t.id}`} label={`× ${t.label}`} onPress={() => unpin($, x => x.id === t.id)} />
        ) : (
          <Button key={`p-${t.id}`} label={labelOf(t)} onPress={() => open(t)} />
        ),
      )}
      {recents.length > 0 && <Text dimColor>{s.recent}</Text>}
      {recents.map(r =>
        editing ? (
          <Button key={`a-${r.id}`} label={`＋ ${r.label}`} onPress={() => pin($, { id: r.id, label: r.label })} />
        ) : (
          <Button key={`r-${r.id}`} label={labelOf(r)} onPress={() => open(r)} />
        ),
      )}
      {editing && current && (
        <Button key="pin-here" label={isHerePinned ? s.unpinHere : s.pinHere} onPress={togglePinHere} />
      )}
      <Button key="edit" label={editing ? s.done : s.edit} onPress={toggleEdit} />
    </Box>
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    try {
      const entry = (await $.env.get('CLAUDE_CODE_ENTRYPOINT')) ?? '?'
      hostEnv = entry === 'claude-desktop' ? ((await $.env.get('CLAUDE_CODE_HOST_SESSION_ID')) ?? '') : ''
      const lang = await readDesktopLocale($)
      await update($, locale, () => lang)
      await $.store.delete('diag')
      await refresh($)

      const s = STRINGS[lang]
      await $.command.register({ name: 'tabs-add', description: s.addDesc, argumentHint: s.addHint })
      await $.command.register({ name: 'tabs-remove', description: s.removeDesc, argumentHint: s.removeHint })
      await $.command.register({ name: 'tabs-list', description: s.listDesc })

      // 定時重讀：其他 session 的釘選、最近使用與狀態才會即時出現，不用等這個 session 有新對話。
      // 要用 $.clock.every：hook 有自己的時間額度，在 hook 裡 sleep 迴圈會被中止；
      // every 的計時器會一直跑到 mod 重新載入。
      $.clock.every(POLL_MS, async () => {
        try {
          await refresh($)
        } catch {
          // 下一輪再試
        }
      })
    } catch {
      // 快捷列出錯不能影響 session 本身
    }
    return next(e)
  })

  // 送出訊息：記到最近使用、標成執行中、重讀 desktop 語言
  on('prompt.submit', async ($, e, next) => {
    try {
      if (!e.command) {
        askedBlocking = false
        usedWrapUp = false
        await touch($, e.text)
        await setStatus($, 'working')
      }
      const lang = await readDesktopLocale($)
      await update($, locale, () => lang)
    } catch {
      // 同上
    }
    return next(e)
  })

  // 回合結束：要你回答才能繼續的算「需要回覆」，其餘算「需要查看」。
  // 子代理的回合不算；你自己中斷的回合表示你正在看，清掉狀態。
  on('turn.complete', async ($, e, next) => {
    try {
      if (!e.agentId) {
        const asksQuestion = !usedWrapUp && /[?？]\s*$/.test(e.answer.trim())
        await setStatus($, e.isAborted ? undefined : askedBlocking || asksQuestion ? 'reply' : 'review')
        askedBlocking = false
        usedWrapUp = false
      }
    } catch {
      // 同上
    }
    return next(e)
  })

  // desktop 的 wrap_up：blocked 為 true 表示要等你回答才能繼續
  on('tool.call', { tool: 'mcp__ccd_turn__wrap_up' }, async ($, e, next) => {
    const args = e as unknown as { ask?: unknown; blocked?: unknown }
    usedWrapUp = true
    if (typeof args.ask === 'string' && args.ask.trim() && args.blocked === true) {
      askedBlocking = true
    }
    return next(e)
  })

  // 要你允許工具時算需要回覆，工具跑完（允許或拒絕後）回到執行中
  on('classic.PermissionRequest', async ($, e, next) => {
    try {
      awaitingAnswer = true
      await setStatus($, 'reply')
    } catch {
      // 不影響權限詢問本身
    }
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    if (awaitingAnswer) {
      awaitingAnswer = false
      try {
        await setStatus($, 'working')
      } catch {
        // 同上
      }
    }
    return result
  })

  // 問你選擇題時也算需要回覆，答完回到執行中
  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    try {
      await setStatus($, 'reply')
    } catch {
      // 不影響提問本身
    }
    const result = await next(e)
    try {
      await setStatus($, 'working')
    } catch {
      // 同上
    }
    return result
  })

  on('session.end', async ($, e, next) => {
    try {
      await setStatus($, undefined)
    } catch {
      // session 要結束了，不處理
    }
    return next(e)
  })

  const describe = (s: Strings, tabs: Tab[], recents: Recent[]) =>
    [
      `${s.listPinned}:`,
      ...(tabs.length ? tabs.map((t, i) => `  ${i + 1}. ${t.label}  (${t.id})`) : [`  ${s.none}`]),
      `${s.listRecent}:`,
      ...(recents.length ? recents.map((r, i) => `  ${i + 1}. ${r.label}  (${r.id})`) : [`  ${s.none}`]),
    ].join('\n')

  on('command.run', { command: 'tabs-add' }, async ($, e) => {
    const s = STRINGS[await read($, locale)]
    const args = e.args.trim()
    const match = args.match(/^(.*?)\s*(local_[0-9a-f-]+)$/i)
    let id = match?.[2]
    let label = (match ? match[1] : args)?.trim() ?? ''
    if (!id) {
      id = currentId()
      if (!id) {
        return { text: s.noHost }
      }
    }
    if (!label) {
      label = await labelHere($, id)
    }
    const next = await pin($, { label, id })
    return { text: `${s.added(label)}\n${describe(s, next, await read($, recent))}` }
  })

  on('command.run', { command: 'tabs-remove' }, async ($, e) => {
    const s = STRINGS[await read($, locale)]
    const label = e.args.trim()
    if (!label) {
      // 不給名稱：移除目前這個 session 的釘選
      const id = currentId()
      if (!id) {
        return { text: s.removeNoHost }
      }
      const { list, next } = await unpin($, t => t.id === id)
      const gone = list.find(t => t.id === id)
      if (!gone) {
        return { text: `${s.notPinnedHere}\n${describe(s, list, await read($, recent))}` }
      }
      return { text: `${s.removed(gone.label)}\n${describe(s, next, await read($, recent))}` }
    }
    const { list, next } = await unpin($, t => t.label === label)
    if (next.length === list.length) {
      return { text: `${s.notFound(label)}\n${describe(s, list, await read($, recent))}` }
    }
    return { text: `${s.removed(label)}\n${describe(s, next, await read($, recent))}` }
  })

  on('command.run', { command: 'tabs-list' }, async $ => {
    const s = STRINGS[await read($, locale)]
    return { text: describe(s, await read($, pinned), await read($, recent)) }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }
    try {
      return await band($, e)
    } catch (error) {
      // 畫不出來時直接在快捷列顯示原因
      const { Text } = $.ui.resolve(e)
      return <Text color="error">session-tabs: {String(error).slice(0, 200)}</Text>
    }
  })
}
