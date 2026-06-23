import { readJson, writeJson } from './jsonStore'

const FILE = 'feishu-daily-brief.json'

export interface FeishuDailyBriefStore {
  version: number
  lastSentDate: string | null
  lastSentAt: string | null
}

export function defaultFeishuDailyBriefStore(): FeishuDailyBriefStore {
  return {
    version: 1,
    lastSentDate: null,
    lastSentAt: null,
  }
}

export function getFeishuDailyBriefStore(): FeishuDailyBriefStore {
  return readJson<FeishuDailyBriefStore>(FILE, defaultFeishuDailyBriefStore())
}

export function saveFeishuDailyBriefStore(store: FeishuDailyBriefStore): void {
  writeJson(FILE, store)
}
