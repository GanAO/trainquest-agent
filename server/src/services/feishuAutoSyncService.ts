import { runFeishuBaseSync } from './feishuBaseSyncService'
import { getFeishuSyncConfig } from '../repositories/feishuSyncRepo'

export interface AutoSyncState {
  queued: boolean
  running: boolean
  lastReason: string | null
  lastError: string | null
}

let timer: NodeJS.Timeout | null = null
let running = false
let queuedReason: string | null = null
let lastError: string | null = null

const SYNC_DEBOUNCE_MS = Number(process.env.FEISHU_SYNC_DEBOUNCE_MS ?? 1500)

function shouldAutoSync(): boolean {
  return process.env.FEISHU_AUTO_SYNC_ENABLED !== 'false'
}

async function drainQueue(): Promise<void> {
  if (running) return
  const reason = queuedReason
  queuedReason = null
  if (!reason || !shouldAutoSync()) return

  running = true
  try {
    runFeishuBaseSync(reason)
    lastError = null
  } catch (err) {
    lastError = (err as Error).message
    console.warn('[FeishuSync] auto sync failed:', lastError)
  } finally {
    running = false
    if (queuedReason) {
      timer = setTimeout(() => {
        timer = null
        void drainQueue()
      }, SYNC_DEBOUNCE_MS)
    }
  }
}

export function enqueueFeishuAutoSync(reason: string): void {
  if (!shouldAutoSync()) return
  queuedReason = reason
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    void drainQueue()
  }, SYNC_DEBOUNCE_MS)
}

export function getFeishuAutoSyncState(): AutoSyncState {
  return {
    queued: queuedReason !== null,
    running,
    lastReason: queuedReason,
    lastError,
  }
}

export function getFeishuSyncStatusText(): string {
  const config = getFeishuSyncConfig()
  const auto = getFeishuAutoSyncState()
  if (auto.running) return '正在同步'
  if (auto.queued) return '等待同步'
  if (config.sync.status === 'success') return `已同步：${config.sync.lastSyncedAt ?? ''}`.trim()
  if (config.sync.status === 'failed') return `同步失败：${config.sync.lastSyncError ?? '未知错误'}`
  return '尚未同步'
}
