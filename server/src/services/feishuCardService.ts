import type { WorkoutProcessResult, WorkoutRecord, StrengthExercise, CardioExercise } from '../domain/types'
import { ATTRIBUTE_LABELS } from '../domain/defaults'
import { getFeishuSyncConfig } from '../repositories/feishuSyncRepo'
import type { FeishuSyncResult } from './feishuBaseSyncService'

export type FeishuCard = Record<string, unknown>

function markdown(content: string): Record<string, unknown> {
  return { tag: 'lark_md', content }
}

function plain(content: string): Record<string, unknown> {
  return { tag: 'plain_text', content }
}

function exerciseLine(ex: WorkoutProcessResult['workout']['exercises'][number]): string {
  if (ex.type === 'strength') {
    const s = ex as StrengthExercise
    const weight = s.weight > 0 ? ` ${s.weight}${s.unit}` : ''
    const note = s.note ? ` [${s.note}]` : ''
    return `- ${s.name}${note} ${s.sets}x${s.reps}${weight}`
  }
  const c = ex as CardioExercise
  const dist = c.distance != null ? ` ${c.distance}${c.distanceUnit ?? 'km'}` : ''
  return `- ${c.name} ${c.duration}分钟${dist}`
}

function syncActions(): Record<string, unknown> | null {
  const config = getFeishuSyncConfig()
  const actions: Record<string, unknown>[] = []
  if (config.dashboardUrl) {
    actions.push({
      tag: 'button',
      text: plain('打开训练看板'),
      type: 'primary',
      url: config.dashboardUrl,
    })
  }
  if (config.baseUrl) {
    actions.push({
      tag: 'button',
      text: plain('打开数据中心'),
      type: 'default',
      url: config.baseUrl,
    })
  }
  if (actions.length === 0) return null
  return { tag: 'action', actions }
}

function baseCard(title: string, template: string, elements: Record<string, unknown>[]): FeishuCard {
  const actions = syncActions()
  return {
    config: { wide_screen_mode: true },
    header: {
      template,
      title: plain(title),
    },
    elements: actions ? [...elements, { tag: 'hr' }, actions] : elements,
  }
}

export function buildWorkoutSavedCard(result: WorkoutProcessResult): FeishuCard {
  const lines = result.workout.exercises.map(exerciseLine)
  const growthLines = result.xpGains.map(gain => {
    const label = ATTRIBUTE_LABELS[gain.attribute] ?? gain.attribute
    const levelUp = result.levelUps.find(item => item.attribute === gain.attribute)
    const suffix = levelUp ? ` Lv${levelUp.fromLevel}->${levelUp.toLevel}` : ''
    return `- ${label} +${gain.xp} XP${suffix}`
  })
  const achievementLine = result.newAchievements.length > 0
    ? `\n**新成就**：${result.newAchievements.map(a => a.name).join('、')}`
    : ''

  return baseCard('训练已记录', 'green', [
    {
      tag: 'div',
      text: markdown(`**${result.workout.date}**\n${lines.join('\n')}`),
    },
    {
      tag: 'div',
      text: markdown(`**成长**\n${growthLines.length > 0 ? growthLines.join('\n') : '暂无 XP 变化'}${achievementLine}`),
    },
    {
      tag: 'div',
      text: markdown('**同步状态**：已保存，本地后台正在同步飞书看板。'),
    },
  ])
}

export function buildWorkoutSavedBatchCard(results: WorkoutProcessResult[]): FeishuCard {
  const elements: Record<string, unknown>[] = []

  results.forEach(result => {
    const lines = result.workout.exercises.map(exerciseLine)
    const xp = result.xpGains.reduce((sum, gain) => sum + gain.xp, 0)
    const achievements = result.newAchievements.map(a => a.name).join('、')
    elements.push({
      tag: 'div',
      text: markdown([
        `**${result.workout.date}**`,
        ...lines,
        `成长：+${xp} XP`,
        achievements ? `新成就：${achievements}` : '',
      ].filter(Boolean).join('\n')),
    })
  })

  elements.push({
    tag: 'div',
    text: markdown('**同步状态**：已保存，本地后台正在同步飞书看板。'),
  })

  return baseCard(`已记录 ${results.length} 次训练`, 'green', elements)
}

export function buildWorkoutPreviewBatchCard(drafts: Array<{ date: string; exercises: WorkoutProcessResult['workout']['exercises'] }>): FeishuCard {
  return baseCard(`识别到 ${drafts.length} 天训练`, 'blue', drafts.map(draft => ({
    tag: 'div',
    text: markdown(`**${draft.date}**\n${draft.exercises.map(exerciseLine).join('\n')}`),
  })))
}

export function buildSyncSuccessCard(result: FeishuSyncResult): FeishuCard {
  const { counts } = result
  return baseCard('训练看板已同步', 'blue', [
    {
      tag: 'div',
      text: markdown([
        `训练记录：${counts.workouts} 条`,
        `动作明细：${counts.exerciseLogs} 条`,
        `属性成长：${counts.attributes} 条`,
        `成就记录：${counts.achievements} 条`,
        `每日汇总：${counts.dailySummary} 条`,
      ].join('\n')),
    },
  ])
}

export function buildSyncFailedCard(message: string): FeishuCard {
  return baseCard('看板同步失败', 'red', [
    {
      tag: 'div',
      text: markdown(`本地训练数据没有受到影响。\n\n失败原因：${message}`),
    },
  ])
}

export function buildSyncStatusCard(statusText: string): FeishuCard {
  return baseCard('训练看板同步状态', 'wathet', [
    {
      tag: 'div',
      text: markdown(statusText),
    },
  ])
}

export function buildWorkoutListCard(title: string, workouts: WorkoutRecord[]): FeishuCard {
  if (workouts.length === 0) {
    return baseCard(title, 'grey', [
      {
        tag: 'div',
        text: markdown('暂无训练记录。'),
      },
    ])
  }

  const elements: Record<string, unknown>[] = workouts.slice(0, 5).map(workout => ({
    tag: 'div',
    text: markdown(`**${workout.date}**\n${workout.exercises.map(exerciseLine).join('\n')}`),
  }))

  return baseCard(title, 'blue', elements)
}

export function buildDailyBriefCard(options: {
  title: string
  lines: string[]
  dashboardUrl?: string | null
  baseUrl?: string | null
}): FeishuCard {
  const actions: Record<string, unknown>[] = []
  if (options.dashboardUrl) {
    actions.push({
      tag: 'button',
      text: plain('打开训练看板'),
      type: 'primary',
      url: options.dashboardUrl,
    })
  }
  if (options.baseUrl) {
    actions.push({
      tag: 'button',
      text: plain('打开数据中心'),
      type: 'default',
      url: options.baseUrl,
    })
  }

  const elements: Record<string, unknown>[] = [
    {
      tag: 'div',
      text: markdown(options.lines.join('\n')),
    },
  ]
  if (actions.length > 0) {
    elements.push({ tag: 'hr' }, { tag: 'action', actions })
  }

  return {
    config: { wide_screen_mode: true },
    header: {
      template: 'green',
      title: plain(options.title),
    },
    elements,
  }
}
