import { execFileSync } from 'child_process'
import {
  getFeishuSyncConfig,
  saveFeishuSyncConfig,
  updateFeishuSyncStatus,
  type FeishuSyncConfig,
  type FeishuSyncTableKey,
} from '../repositories/feishuSyncRepo'
import { buildFeishuBaseExport, getFeishuExportCounts, type FeishuBaseExport, type FeishuExportCounts } from './analyticsExportService'

type FieldSchema = Record<string, unknown>
type Row = Record<string, string | number | boolean | null>

export interface FeishuSyncResult {
  ok: true
  counts: FeishuExportCounts
  baseUrl: string | null
  dashboardUrl: string | null
  syncedAt: string
}

const BASE_NAME = 'TrainQuest Agent 训练数据中心'
const LARK_IDENTITY = process.env.FEISHU_SYNC_IDENTITY === 'bot' ? 'bot' : 'user'

const TABLE_NAMES: Record<FeishuSyncTableKey, string> = {
  workouts: '训练记录',
  exerciseLogs: '动作明细',
  attributes: '属性成长',
  achievements: '成就记录',
  dailySummary: '每日汇总',
}

const TABLE_SCHEMAS: Record<FeishuSyncTableKey, FieldSchema[]> = {
  workouts: [
    { type: 'text', name: '训练标题' },
    { type: 'text', name: 'Workout ID' },
    { type: 'datetime', name: '日期', style: { format: 'yyyy-MM-dd' } },
    { type: 'select', name: '来源', options: [{ name: 'manual' }, { name: 'chat' }, { name: 'feishu' }] },
    { type: 'select', name: '状态感受', options: [{ name: 'great' }, { name: 'good' }, { name: 'ok' }, { name: 'tired' }, { name: 'bad' }] },
    { type: 'number', name: '动作数', style: { type: 'plain', precision: 0 } },
    { type: 'number', name: '力量容量 kg', style: { type: 'plain', precision: 2, thousands_separator: true } },
    { type: 'number', name: '有氧分钟', style: { type: 'plain', precision: 0 } },
    { type: 'number', name: '有氧距离', style: { type: 'plain', precision: 2 } },
    { type: 'text', name: '本次主肌群' },
    { type: 'datetime', name: '创建时间', style: { format: 'yyyy-MM-dd HH:mm' } },
  ],
  exerciseLogs: [
    { type: 'text', name: '动作标题' },
    { type: 'text', name: 'Exercise ID' },
    { type: 'text', name: 'Workout ID' },
    { type: 'datetime', name: '日期', style: { format: 'yyyy-MM-dd' } },
    { type: 'text', name: '动作名' },
    { type: 'select', name: '类型', options: [{ name: 'strength' }, { name: 'cardio' }] },
    { type: 'number', name: '组数', style: { type: 'plain', precision: 0 } },
    { type: 'number', name: '次数', style: { type: 'plain', precision: 0 } },
    { type: 'number', name: '重量', style: { type: 'plain', precision: 2 } },
    { type: 'text', name: '单位' },
    { type: 'number', name: '训练容量 kg', style: { type: 'plain', precision: 2, thousands_separator: true } },
    { type: 'number', name: '时长分钟', style: { type: 'plain', precision: 0 } },
    { type: 'number', name: '距离', style: { type: 'plain', precision: 2 } },
    { type: 'text', name: '备注' },
    { type: 'text', name: '主肌群' },
    { type: 'text', name: '次肌群' },
    { type: 'select', name: '来源', options: [{ name: 'manual' }, { name: 'chat' }, { name: 'feishu' }] },
  ],
  attributes: [
    { type: 'text', name: '属性' },
    { type: 'text', name: '属性键' },
    { type: 'number', name: '等级', style: { type: 'plain', precision: 0 } },
    { type: 'number', name: '当前XP', style: { type: 'plain', precision: 0 } },
    { type: 'number', name: '累计XP', style: { type: 'plain', precision: 0 } },
    { type: 'datetime', name: '最近变化时间', style: { format: 'yyyy-MM-dd HH:mm' } },
  ],
  achievements: [
    { type: 'text', name: '成就名称' },
    { type: 'text', name: 'Achievement ID' },
    { type: 'select', name: '类型', options: [{ name: 'habit' }, { name: 'breakthrough' }, { name: 'goal' }] },
    { type: 'text', name: '描述' },
    { type: 'checkbox', name: '是否解锁' },
    { type: 'datetime', name: '解锁时间', style: { format: 'yyyy-MM-dd HH:mm' } },
    { type: 'text', name: '触发条件' },
  ],
  dailySummary: [
    { type: 'datetime', name: '日期', style: { format: 'yyyy-MM-dd' } },
    { type: 'number', name: '训练次数', style: { type: 'plain', precision: 0 } },
    { type: 'number', name: '动作数', style: { type: 'plain', precision: 0 } },
    { type: 'number', name: '力量容量 kg', style: { type: 'plain', precision: 2, thousands_separator: true } },
    { type: 'number', name: '有氧分钟', style: { type: 'plain', precision: 0 } },
    { type: 'number', name: '有氧距离', style: { type: 'plain', precision: 2 } },
    { type: 'text', name: '涉及肌群' },
    { type: 'text', name: '主要动作' },
  ],
}

function runLark(args: string[]): unknown {
  const output = execFileSync('lark-cli', args, {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120000,
  })
  return output.trim() ? JSON.parse(output) : {}
}

function firstString(value: unknown, keys: string[]): string | null {
  if (!value || typeof value !== 'object') return null
  const obj = value as Record<string, unknown>
  for (const key of keys) {
    const current = obj[key]
    if (typeof current === 'string' && current) return current
  }
  for (const child of Object.values(obj)) {
    const found = firstString(child, keys)
    if (found) return found
  }
  return null
}

function collectTables(value: unknown, out: Array<{ name?: string; id?: string }> = []): Array<{ name?: string; id?: string }> {
  if (!value || typeof value !== 'object') return out
  if (Array.isArray(value)) {
    value.forEach(item => collectTables(item, out))
    return out
  }
  const obj = value as Record<string, unknown>
  const id = typeof obj.table_id === 'string' ? obj.table_id : typeof obj.id === 'string' ? obj.id : undefined
  const name =
    typeof obj.name === 'string' ? obj.name :
      typeof obj.table_name === 'string' ? obj.table_name :
        typeof obj.title === 'string' ? obj.title :
          undefined
  if (id?.startsWith('tbl') && name) out.push({ id, name })
  Object.values(obj).forEach(item => collectTables(item, out))
  return out
}

function collectRecordIds(value: unknown, out = new Set<string>()): string[] {
  if (!value || typeof value !== 'object') return Array.from(out)
  if (Array.isArray(value)) {
    value.forEach(item => {
      if (typeof item === 'string' && item.startsWith('rec')) {
        out.add(item)
      } else {
        collectRecordIds(item, out)
      }
    })
    return Array.from(out)
  }
  const obj = value as Record<string, unknown>
  const id = typeof obj.record_id === 'string' ? obj.record_id : undefined
  if (id?.startsWith('rec')) out.add(id)
  const ids = obj.record_id_list
  if (Array.isArray(ids)) {
    ids.forEach(item => {
      if (typeof item === 'string' && item.startsWith('rec')) out.add(item)
    })
  }
  Object.values(obj).forEach(item => collectRecordIds(item, out))
  return Array.from(out)
}

function baseUrl(baseToken: string): string {
  return `https://feishu.cn/base/${baseToken}`
}

function dashboardUrl(baseToken: string, dashboardId: string): string {
  return `https://feishu.cn/base/${baseToken}?table=${dashboardId}`
}

function ensureBase(config: FeishuSyncConfig): FeishuSyncConfig {
  if (config.baseToken) return config

  const created = runLark([
    'base', '+base-create',
    '--as', LARK_IDENTITY,
    '--name', BASE_NAME,
    '--time-zone', 'Asia/Shanghai',
    '--table-name', TABLE_NAMES.workouts,
    '--fields', JSON.stringify(TABLE_SCHEMAS.workouts),
    '--format', 'json',
  ])

  const token = firstString(created, ['app_token', 'base_token', 'token'])
  if (!token) {
    throw new Error('创建飞书 Base 成功但未能解析 base token')
  }

  config.baseName = BASE_NAME
  config.baseToken = token
  config.baseUrl = baseUrl(token)
  saveFeishuSyncConfig(config)
  return config
}

function listTables(baseToken: string): Array<{ name?: string; id?: string }> {
  const output = runLark([
    'base', '+table-list',
    '--as', LARK_IDENTITY,
    '--base-token', baseToken,
    '--format', 'json',
  ])
  return collectTables(output)
}

function ensureTables(config: FeishuSyncConfig): FeishuSyncConfig {
  const baseToken = config.baseToken
  if (!baseToken) throw new Error('缺少飞书 Base token')

  let tables = listTables(baseToken)

  for (const key of Object.keys(TABLE_NAMES) as FeishuSyncTableKey[]) {
    const name = TABLE_NAMES[key]
    const existing = tables.find(t => t.name === name)
    if (existing?.id) {
      config.tables[key] = existing.id
      continue
    }

    runLark([
      'base', '+table-create',
      '--as', LARK_IDENTITY,
      '--base-token', baseToken,
      '--name', name,
      '--fields', JSON.stringify(TABLE_SCHEMAS[key]),
      '--format', 'json',
    ])
    tables = listTables(baseToken)
    const created = tables.find(t => t.name === name)
    if (!created?.id) throw new Error(`创建表「${name}」后未能定位 table_id`)
    config.tables[key] = created.id
  }

  saveFeishuSyncConfig(config)
  return config
}

function createDashboardBlock(
  baseToken: string,
  dashboardId: string,
  name: string,
  type: string,
  dataConfig: Record<string, unknown>,
): void {
  runLark([
    'base', '+dashboard-block-create',
    '--as', LARK_IDENTITY,
    '--base-token', baseToken,
    '--dashboard-id', dashboardId,
    '--name', name,
    '--type', type,
    '--data-config', JSON.stringify(dataConfig),
    '--format', 'json',
  ])
}

function ensureDashboard(config: FeishuSyncConfig): FeishuSyncConfig {
  const baseToken = config.baseToken
  if (!baseToken) throw new Error('缺少飞书 Base token')
  if (config.dashboardId) return config

  const output = runLark([
    'base', '+dashboard-create',
    '--as', LARK_IDENTITY,
    '--base-token', baseToken,
    '--name', '训练看板',
    '--format', 'json',
  ])
  const dashboardId = firstString(output, ['dashboard_id', 'block_id', 'id'])
  if (!dashboardId) throw new Error('创建 Dashboard 成功但未能解析 dashboard_id')

  createDashboardBlock(baseToken, dashboardId, '总训练次数', 'statistics', {
    table_name: TABLE_NAMES.workouts,
    count_all: true,
  })
  createDashboardBlock(baseToken, dashboardId, '总力量容量 kg', 'statistics', {
    table_name: TABLE_NAMES.dailySummary,
    series: [{ field_name: '力量容量 kg', rollup: 'SUM' }],
  })
  createDashboardBlock(baseToken, dashboardId, '总有氧分钟', 'statistics', {
    table_name: TABLE_NAMES.dailySummary,
    series: [{ field_name: '有氧分钟', rollup: 'SUM' }],
  })
  createDashboardBlock(baseToken, dashboardId, '每日训练次数趋势', 'line', {
    table_name: TABLE_NAMES.dailySummary,
    series: [{ field_name: '训练次数', rollup: 'SUM' }],
    group_by: [{ field_name: '日期', mode: 'integrated', sort: { type: 'group', order: 'asc' } }],
  })
  createDashboardBlock(baseToken, dashboardId, '每日力量容量趋势', 'column', {
    table_name: TABLE_NAMES.dailySummary,
    series: [{ field_name: '力量容量 kg', rollup: 'SUM' }],
    group_by: [{ field_name: '日期', mode: 'integrated', sort: { type: 'group', order: 'asc' } }],
  })
  createDashboardBlock(baseToken, dashboardId, '动作类型分布', 'pie', {
    table_name: TABLE_NAMES.exerciseLogs,
    count_all: true,
    group_by: [{ field_name: '类型', mode: 'integrated' }],
  })
  createDashboardBlock(baseToken, dashboardId, '属性累计 XP', 'column', {
    table_name: TABLE_NAMES.attributes,
    series: [{ field_name: '累计XP', rollup: 'SUM' }],
    group_by: [{ field_name: '属性', mode: 'integrated', sort: { type: 'value', order: 'desc' } }],
  })
  createDashboardBlock(baseToken, dashboardId, '说明', 'text', {
    text: '# TrainQuest Agent 训练看板\n本看板由本地 TrainQuest Agent 自动同步生成。飞书多维表格是只读镜像，训练计算仍以本地数据为准。',
  })

  runLark([
    'base', '+dashboard-arrange',
    '--as', LARK_IDENTITY,
    '--base-token', baseToken,
    '--dashboard-id', dashboardId,
    '--format', 'json',
  ])

  config.dashboardId = dashboardId
  config.dashboardUrl = dashboardUrl(baseToken, dashboardId)
  saveFeishuSyncConfig(config)
  return config
}

function clearTable(baseToken: string, tableId: string): void {
  while (true) {
    const listed = runLark([
      'base', '+record-list',
      '--as', LARK_IDENTITY,
      '--base-token', baseToken,
      '--table-id', tableId,
      '--limit', '200',
      '--format', 'json',
    ])
    const recordIds = collectRecordIds(listed)
    if (recordIds.length === 0) return
    runLark([
      'base', '+record-delete',
      '--as', LARK_IDENTITY,
      '--base-token', baseToken,
      '--table-id', tableId,
      '--json', JSON.stringify({ record_id_list: recordIds.slice(0, 200) }),
      '--yes',
      '--format', 'json',
    ])
  }
}

function batchCreateRows(baseToken: string, tableId: string, rows: Row[]): void {
  if (rows.length === 0) return
  const fields = Object.keys(rows[0])
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200)
    runLark([
      'base', '+record-batch-create',
      '--as', LARK_IDENTITY,
      '--base-token', baseToken,
      '--table-id', tableId,
      '--json', JSON.stringify({
        fields,
        rows: chunk.map(row => fields.map(field => row[field] ?? null)),
      }),
      '--format', 'json',
    ])
  }
}

function writeMirror(config: FeishuSyncConfig, data: FeishuBaseExport): void {
  const baseToken = config.baseToken
  if (!baseToken) throw new Error('缺少飞书 Base token')

  const entries: Array<[FeishuSyncTableKey, Row[]]> = [
    ['workouts', data.workouts],
    ['exerciseLogs', data.exerciseLogs],
    ['attributes', data.attributes],
    ['achievements', data.achievements],
    ['dailySummary', data.dailySummary],
  ]

  for (const [key, rows] of entries) {
    const tableId = config.tables[key]
    if (!tableId) throw new Error(`缺少「${TABLE_NAMES[key]}」table_id`)
    clearTable(baseToken, tableId)
    batchCreateRows(baseToken, tableId, rows)
  }
}

export function runFeishuBaseSync(reason = 'manual'): FeishuSyncResult {
  updateFeishuSyncStatus({
    status: 'syncing',
    reason,
    lastStartedAt: new Date().toISOString(),
    lastSyncError: undefined,
  })

  try {
    let config = getFeishuSyncConfig()
    config = ensureBase(config)
    config = ensureTables(config)
    config = ensureDashboard(config)

    const data = buildFeishuBaseExport()
    writeMirror(config, data)

    const syncedAt = new Date().toISOString()
    const counts = getFeishuExportCounts(data)
    config = getFeishuSyncConfig()
    config.baseUrl = config.baseToken ? baseUrl(config.baseToken) : config.baseUrl
    config.dashboardUrl = config.baseToken && config.dashboardId
      ? dashboardUrl(config.baseToken, config.dashboardId)
      : config.dashboardUrl
    config.sync = {
      status: 'success',
      reason,
      lastStartedAt: config.sync.lastStartedAt,
      lastSyncedAt: syncedAt,
      lastSyncError: undefined,
    }
    saveFeishuSyncConfig(config)

    return {
      ok: true,
      counts,
      baseUrl: config.baseUrl,
      dashboardUrl: config.dashboardUrl,
      syncedAt,
    }
  } catch (err) {
    updateFeishuSyncStatus({
      status: 'failed',
      reason,
      lastSyncError: (err as Error).message,
    })
    throw err
  }
}
