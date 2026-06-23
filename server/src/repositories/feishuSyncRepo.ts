import { readJson, writeJson } from './jsonStore'

const FILE = 'feishu-sync.json'

export type FeishuSyncTableKey =
  | 'workouts'
  | 'exerciseLogs'
  | 'attributes'
  | 'achievements'
  | 'dailySummary'

export interface FeishuSyncStatus {
  status: 'idle' | 'syncing' | 'success' | 'failed'
  reason?: string
  lastStartedAt?: string
  lastSyncedAt?: string
  lastSyncError?: string
}

export interface FeishuSyncConfig {
  version: number
  baseName: string
  baseToken: string | null
  baseUrl: string | null
  dashboardId: string | null
  dashboardUrl: string | null
  tables: Partial<Record<FeishuSyncTableKey, string>>
  createdByVersion: string
  sync: FeishuSyncStatus
}

export function defaultFeishuSyncConfig(): FeishuSyncConfig {
  return {
    version: 1,
    baseName: 'TrainQuest Agent 训练数据中心',
    baseToken: null,
    baseUrl: null,
    dashboardId: null,
    dashboardUrl: null,
    tables: {},
    createdByVersion: 'v1',
    sync: { status: 'idle' },
  }
}

export function getFeishuSyncConfig(): FeishuSyncConfig {
  return readJson<FeishuSyncConfig>(FILE, defaultFeishuSyncConfig())
}

export function saveFeishuSyncConfig(config: FeishuSyncConfig): void {
  writeJson(FILE, config)
}

export function updateFeishuSyncStatus(patch: Partial<FeishuSyncStatus>): FeishuSyncConfig {
  const config = getFeishuSyncConfig()
  config.sync = { ...config.sync, ...patch }
  saveFeishuSyncConfig(config)
  return config
}
