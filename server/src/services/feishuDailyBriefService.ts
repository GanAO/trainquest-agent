import { getAllWorkouts } from '../repositories/workoutRepo'
import { getFeishuSyncConfig } from '../repositories/feishuSyncRepo'
import {
  getFeishuDailyBriefStore,
  saveFeishuDailyBriefStore,
} from '../repositories/feishuDailyBriefRepo'
import { sendFeishuCardToChat } from './feishuSenderService'
import { buildDailyBriefCard } from './feishuCardService'
import { localToday } from './feishuQueryService'
import type { WorkoutRecord } from '../domain/types'

const DEFAULT_TIME = '08:30'
const CHECK_INTERVAL_MS = 60 * 1000
const PRESSURE_WORDS = [
  '必须',
  '落后',
  '坚持打卡',
  '别偷懒',
  '再不练',
  '不能偷懒',
  '赶上',
  '惩罚',
]

let timer: NodeJS.Timeout | null = null

function todayInShanghai(): string {
  return localToday()
}

function nowTimeInShanghai(): string {
  return new Date().toLocaleTimeString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  })
}

function parseScheduleTime(): string {
  const raw = process.env.FEISHU_DAILY_BRIEF_TIME ?? DEFAULT_TIME
  return /^\d{2}:\d{2}$/.test(raw) ? raw : DEFAULT_TIME
}

function shouldEnableDailyBrief(): boolean {
  return process.env.FEISHU_DAILY_BRIEF_ENABLED !== 'false'
}

function sanitizeLine(line: string): string {
  let next = line
  PRESSURE_WORDS.forEach(word => {
    next = next.split(word).join('可以')
  })
  return next
}

function daysSince(date: string, today: string): number {
  const a = new Date(`${date}T00:00:00+08:00`).getTime()
  const b = new Date(`${today}T00:00:00+08:00`).getTime()
  return Math.round((b - a) / (1000 * 60 * 60 * 24))
}

function recentSummary(workouts: WorkoutRecord[], today: string): string {
  if (workouts.length === 0) {
    return '最近还没有训练记录，今天如果有空，可以从 10 分钟轻量活动开始。'
  }
  const sorted = workouts.slice().sort((a, b) => b.date.localeCompare(a.date))
  const latest = sorted[0]
  const gap = daysSince(latest.date, today)
  const weekAgo = new Date(`${today}T00:00:00+08:00`)
  weekAgo.setDate(weekAgo.getDate() - 6)
  const weekStart = weekAgo.toISOString().slice(0, 10)
  const weekCount = sorted.filter(w => w.date >= weekStart && w.date <= today).length
  const gapText = gap === 0 ? '今天已有记录' : gap === 1 ? '上次训练在昨天' : `距离上次训练约 ${gap} 天`
  return `最近 7 天记录了 ${weekCount} 次训练，${gapText}。`
}

function suggestion(workouts: WorkoutRecord[], today: string): string {
  if (workouts.some(w => w.date === today)) {
    return '今天已经有训练记录了，后面可以把注意力放在恢复、补水和睡眠上。'
  }
  const latest = workouts.slice().sort((a, b) => b.date.localeCompare(a.date))[0]
  if (!latest) {
    return '今天可以考虑散步、拉伸或一组轻量自重训练，让身体先进入状态。'
  }
  const gap = daysSince(latest.date, today)
  if (gap <= 1) return '如果身体还有些疲劳，今天做轻量活动或休息都可以。'
  if (gap <= 3) return '如果状态不错，今天可以安排一次短训练，控制在舒服的强度。'
  return '如果今天时间合适，可以从热身和基础动作开始，轻一点也很好。'
}

function knowledgeTip(date: string): string {
  const tips = [
    '热身的目标不是累，而是让关节和呼吸慢慢进入运动状态。',
    '力量训练里，动作质量通常比多加一点重量更值得优先关注。',
    '训练后的轻度拉伸和补水，能让身体更舒服地进入恢复。',
    '有氧不一定要很长，10 到 20 分钟的轻松活动也有价值。',
    '同一个动作连续进步时，2.5% 到 5% 的小幅增加通常更稳。',
  ]
  const index = date.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % tips.length
  return tips[index]
}

export function buildDailyBriefLines(): string[] {
  const today = todayInShanghai()
  const workouts = getAllWorkouts()
  return [
    '**早上好，今天也按舒服的节奏来。**',
    '',
    recentSummary(workouts, today),
    suggestion(workouts, today),
    '',
    `小知识：${knowledgeTip(today)}`,
  ].map(sanitizeLine)
}

export async function sendDailyBriefIfDue(force = false): Promise<boolean> {
  if (!shouldEnableDailyBrief()) return false
  const chatId = process.env.FEISHU_DAILY_BRIEF_CHAT_ID
  if (!chatId) {
    console.log('[FeishuDailyBrief] FEISHU_DAILY_BRIEF_CHAT_ID not set, daily brief disabled')
    return false
  }

  const today = todayInShanghai()
  const store = getFeishuDailyBriefStore()
  if (!force && store.lastSentDate === today) return false

  const config = getFeishuSyncConfig()
  const card = buildDailyBriefCard({
    title: 'TrainQuest Agent 今日轻量日报',
    lines: buildDailyBriefLines(),
    dashboardUrl: config.dashboardUrl,
    baseUrl: config.baseUrl,
  })

  await sendFeishuCardToChat(chatId, card)
  saveFeishuDailyBriefStore({
    ...store,
    lastSentDate: today,
    lastSentAt: new Date().toISOString(),
  })
  return true
}

async function tick(): Promise<void> {
  const dueTime = parseScheduleTime()
  if (nowTimeInShanghai() >= dueTime) {
    try {
      await sendDailyBriefIfDue(false)
    } catch (err) {
      console.warn('[FeishuDailyBrief] send failed:', (err as Error).message)
    }
  }
}

export function startFeishuDailyBriefScheduler(): void {
  if (timer) return
  if (!shouldEnableDailyBrief()) {
    console.log('[FeishuDailyBrief] disabled by FEISHU_DAILY_BRIEF_ENABLED=false')
    return
  }
  if (!process.env.FEISHU_DAILY_BRIEF_CHAT_ID) {
    console.log('[FeishuDailyBrief] FEISHU_DAILY_BRIEF_CHAT_ID not set, scheduler not started')
    return
  }
  timer = setInterval(() => {
    void tick()
  }, CHECK_INTERVAL_MS)
  void tick()
  console.log(`[FeishuDailyBrief] scheduler started at ${parseScheduleTime()} Asia/Shanghai`)
}
