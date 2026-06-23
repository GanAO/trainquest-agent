import type { WorkoutProcessResult, StrengthExercise, CardioExercise, AttributeKey } from '../domain/types'
import type { TrainingDraft } from './trainingTextParser'
import type { WorkoutRecord } from '../domain/types'
import { ATTRIBUTE_LABELS } from '../domain/defaults'

// ─── 单个动作格式化 ────────────────────────────────────────────────────────────

type ExerciseInput = TrainingDraft['exercises'][number]

export function fmtExerciseDraft(ex: ExerciseInput): string {
  if (ex.type === 'strength') {
    const s = ex as Omit<StrengthExercise, 'id'>
    const note = s.note ? `  [${s.note}]` : ''
    const weight = s.weight > 0 ? `  ${s.weight}${s.unit}` : ''
    const sets = s.sets > 0 ? `${s.sets}` : '?'
    const reps = s.reps > 0 ? `${s.reps}` : '?'
    return `${s.name}${note}    ${sets}×${reps}${weight}`
  }
  const c = ex as Omit<CardioExercise, 'id'>
  const note = c.note ? `  [${c.note}]` : ''
  const dur = c.duration > 0 ? `${c.duration}分钟` : '?分钟'
  const dist = c.distance != null ? `  ${c.distance}${c.distanceUnit ?? 'km'}` : ''
  return `${c.name}${note}    ${dur}${dist}`
}

export function fmtExerciseRecord(ex: WorkoutRecord['exercises'][number]): string {
  if (ex.type === 'strength') {
    const s = ex as StrengthExercise
    const weight = s.weight > 0 ? `  ${s.weight}${s.unit}` : ''
    return `${s.name}    ${s.sets}×${s.reps}${weight}`
  }
  const c = ex as CardioExercise
  const dist = c.distance != null ? `  ${c.distance}${c.distanceUnit ?? 'km'}` : ''
  return `${c.name}    ${c.duration}分钟${dist}`
}

// ─── 草稿预览（待确认） ────────────────────────────────────────────────────────

export function fmtDraftPreview(draft: TrainingDraft, infoWarnings: string[]): string {
  const lines: string[] = ['确认以下训练', '']
  draft.exercises.forEach(ex => lines.push(fmtExerciseDraft(ex)))
  lines.push('', draft.date)
  if (infoWarnings.length > 0) {
    lines.push('')
    infoWarnings.forEach(w => lines.push(`提示：${w}`))
  }
  lines.push('', '回复"确认"保存')
  return lines.join('\n')
}

// ─── 保存成功 ─────────────────────────────────────────────────────────────────

export function fmtSaveSuccess(result: WorkoutProcessResult, withUndo = false): string {
  const lines: string[] = [
    `已记录  ${result.workout.date}`,
    '',
  ]
  result.workout.exercises.forEach(ex => lines.push(fmtExerciseRecord(ex)))

  if (result.xpGains.length > 0) {
    lines.push('', '成长')
    result.xpGains.forEach(g => {
      const lvUp = result.levelUps.find(l => l.attribute === g.attribute)
      const lvStr = lvUp ? `  Lv${lvUp.fromLevel}→${lvUp.toLevel}` : ''
      lines.push(fmtXpBar(g.attribute, lvUp?.toLevel, g.xp) + lvStr)
    })
  }

  if (result.newAchievements.length > 0) {
    lines.push('', `★ 新成就：${result.newAchievements.map(a => a.name).join('、')}`)
  }

  if (withUndo) {
    lines.push('', '回复"撤销"可删除这条记录（10分钟内有效）')
  }

  return lines.join('\n')
}

// ─── 撤销成功 ─────────────────────────────────────────────────────────────────

export function fmtUndoSuccess(date: string): string {
  return `已删除 ${date} 的训练记录，属性已还原`
}

// ─── 缺失字段追问 ──────────────────────────────────────────────────────────────

export function fmtMissingField(exerciseLabel: string, fieldName: 'sets' | 'reps' | 'duration'): string {
  const fieldLabel = { sets: '组数', reps: '每组次数', duration: '时长（分钟）' }[fieldName]
  return `还差一个信息：\n${exerciseLabel}，${fieldLabel}是多少？`
}

// ─── 查询：最近训练 ────────────────────────────────────────────────────────────

export function fmtWorkoutSummary(w: WorkoutRecord): string {
  const lines: string[] = [w.date]
  w.exercises.forEach(ex => lines.push(`  ${fmtExerciseRecord(ex)}`))
  return lines.join('\n')
}

export function fmtRecentWorkouts(workouts: WorkoutRecord[]): string {
  if (workouts.length === 0) return '暂无训练记录'
  const weekLine = fmtWeekSummary(workouts)
  const lines = [weekLine, '', `最近 ${workouts.length} 次训练`, '']
  workouts.forEach((w, i) => {
    if (i > 0) lines.push('')
    lines.push(fmtWorkoutSummary(w))
  })
  return lines.join('\n')
}

export function fmtTodayWorkouts(workouts: WorkoutRecord[], today: string): string {
  if (workouts.length === 0) return `${today} 暂无训练记录`
  const lines = [`今天 ${today}`, '']
  workouts.forEach((w, i) => {
    if (i > 0) lines.push('')
    w.exercises.forEach(ex => lines.push(fmtExerciseRecord(ex)))
  })
  return lines.join('\n')
}

export function fmtLastExercise(
  exerciseName: string,
  workout: WorkoutRecord,
  recentWorkouts?: WorkoutRecord[],
): string {
  const matches = workout.exercises.filter(
    ex => ex.name.toLowerCase().includes(exerciseName.toLowerCase()),
  )
  const lines = [`上次「${exerciseName}」  ${workout.date}`, '']
  matches.forEach(ex => lines.push(fmtExerciseRecord(ex)))
  if (recentWorkouts && recentWorkouts.length > 1) {
    lines.push('', '最近记录', fmtExerciseRecentTable(exerciseName, recentWorkouts))
  }
  return lines.join('\n')
}

// ─── 结构化文本增强 ────────────────────────────────────────────────────────────

export function fmtProgressBar(ratio: number, width = 10): string {
  const clamped = Math.max(0, Math.min(1, ratio))
  const filled = Math.round(clamped * width)
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled)
  return `[${bar}] 约 ${Math.round(clamped * 100)}%`
}

export function fmtBenchmarkProgress(
  name: string,
  current: number,
  targetMin: number,
  targetMax: number,
  unit = 'kg',
): string {
  const mid = (targetMin + targetMax) / 2
  const ratio = mid > 0 ? current / mid : 0
  return `${name}进展\n当前 ${current}${unit} → 目标 ${targetMin}–${targetMax}${unit}\n进度 ${fmtProgressBar(ratio)}`
}

export function fmtExerciseRecentTable(
  exerciseName: string,
  workouts: WorkoutRecord[],
  limit = 3,
): string {
  const name = exerciseName.trim().toLowerCase()
  const lines: string[] = []
  let count = 0
  for (const w of workouts) {
    const matches = w.exercises.filter(ex => ex.name.toLowerCase().includes(name))
    if (matches.length === 0) continue
    for (const ex of matches) {
      const date = w.date.slice(5)
      if (ex.type === 'strength') {
        const s = ex as StrengthExercise
        const weight = s.weight > 0 ? `${s.weight}${s.unit}  ` : ''
        lines.push(`${date}  ${weight}${s.sets}×${s.reps}`)
      } else {
        lines.push(`${date}  ${ex.duration}分钟`)
      }
      count++
      if (count >= limit) return lines.join('\n')
    }
  }
  return lines.length > 0 ? lines.join('\n') : '暂无记录'
}

export function fmtAdviceStructured(basis: string, advice: string, optional?: string): string {
  const lines = ['【依据】', basis.trim(), '', '【建议】', advice.trim()]
  if (optional?.trim()) {
    lines.push('', '【可选调整】', optional.trim())
  }
  return lines.join('\n')
}

export function fmtWeekSummary(workouts: WorkoutRecord[]): string {
  if (workouts.length === 0) return '本周暂无训练'
  const muscles = new Set<string>()
  workouts.forEach(w => {
    w.exercises.forEach(ex => {
      if (/深蹲|硬拉|腿/.test(ex.name)) muscles.add('腿')
      else if (/卧推|胸/.test(ex.name)) muscles.add('胸')
      else if (/引体|划船|背/.test(ex.name)) muscles.add('背')
      else if (/推|肩/.test(ex.name)) muscles.add('肩')
      else if (/跑|泳|骑|绳/.test(ex.name)) muscles.add('有氧')
    })
  })
  const focus = muscles.size > 0 ? Array.from(muscles).join('、') + '为主' : '综合'
  return `本周 ${workouts.length} 次 · ${focus}`
}

export function fmtXpBar(attribute: AttributeKey, level: number | undefined, xp: number): string {
  const label = ATTRIBUTE_LABELS[attribute] ?? attribute
  const lv = level ?? 1
  const bar = fmtProgressBar(Math.min(xp / 100, 1), 5)
  return `  ${label} Lv${lv} ${bar}  +${xp} XP`
}

// ─── 帮助文案 ──────────────────────────────────────────────────────────────────

export const CAPABILITIES_TEXT = `我是你的训练记录助手，可以这样跟我说：

记录训练
  今天卧推40kg三组六个，深蹲60kg四组三个

补充记录
  三个 / 每组8次 / 30分钟

查询
  上次卧推多少？
  最近三次深蹲记录
  今天练了什么？

修改记录
  刚才日期改成昨天
  把卧推重量改成45kg
  删掉刚才记录里的跑步
  给刚才记录加备注：状态一般

训练建议
  今天深蹲建议多少？
  我最近练得是不是太重？
  按我的目标，今天该练什么？
  （建议后可以追问：那加重点呢 / 保守一点呢）

体能表
  查看体能表 / 我的目标
  设置深蹲目标90kg / 更新体重65kg

其他
  确认 / 撤销（10分钟内）
  打开训练看板 / 查看同步状态 / 刷新看板
  每日温和日报可由服务端定时发送`

export const HELP_TEXT = CAPABILITIES_TEXT
