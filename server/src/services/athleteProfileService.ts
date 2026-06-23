import { getAthleteProfile, saveAthleteProfile } from '../repositories/athleteProfileRepo'

export { getAthleteProfile }
import { addWeightLog } from '../repositories/profileRepo'
import { localToday } from './feishuQueryService'
import { fmtBenchmarkProgress } from './feishuFormatter'
import { enqueueFeishuAutoSync } from './feishuAutoSyncService'
import type {
  AthleteBenchmark,
  AthletePosition,
  AthleteProfileStore,
  Sport,
} from '../domain/types'

export const PRIORITY_LABELS: Record<string, string> = {
  max_strength: '最大力量',
  hypertrophy_weight_gain: '增肌增重',
  basketball_explosiveness: '篮球爆发力',
  recovery: '恢复',
}

export const SPORT_LABELS: Record<Sport, string> = {
  basketball: '篮球',
  general: '综合',
}

export const POSITION_LABELS: Record<AthletePosition, string> = {
  guard: '后卫',
  forward: '前锋',
  center: '中锋',
  none: '未设置',
}

const POSITION_ALIASES: Record<string, AthletePosition> = {
  后卫: 'guard',
  控卫: 'guard',
  前锋: 'forward',
  中锋: 'center',
}

const BENCHMARK_NAME_ALIASES: Record<string, string> = {
  体重: 'bodyweight',
  深蹲: 'squat',
  硬拉: 'deadlift',
  卧推: 'bench',
  实力推: 'ohp',
  推举: 'ohp',
  引体: 'pullup_bw',
  引体向上: 'pullup_bw',
}

function touch(profile: AthleteProfileStore): AthleteProfileStore {
  return { ...profile, updatedAt: new Date().toISOString() }
}

export function findBenchmarkByName(name: string): AthleteBenchmark | undefined {
  const profile = getAthleteProfile()
  const key = name.trim()
  const id = BENCHMARK_NAME_ALIASES[key]
  if (id) return profile.benchmarks.find(b => b.id === id)
  return profile.benchmarks.find(
    b => b.exerciseName === key || b.exerciseName.includes(key),
  )
}

export function updateBodyWeight(weightKg: number): AthleteProfileStore {
  const profile = touch(getAthleteProfile())
  profile.basics.bodyWeightKg = weightKg

  const bodyBenchmark = profile.benchmarks.find(b => b.id === 'bodyweight')
  if (bodyBenchmark) {
    bodyBenchmark.currentValue = weightKg
  }

  saveAthleteProfile(profile)

  const today = localToday()
  addWeightLog({ date: today, weightKg })
  enqueueFeishuAutoSync('athlete_weight_updated')

  return profile
}

export function updateBenchmarkTarget(
  exerciseName: string,
  targetMin: number,
  targetMax?: number,
): { ok: true; benchmark: AthleteBenchmark } | { ok: false; message: string } {
  const profile = touch(getAthleteProfile())
  const benchmark = findBenchmarkByName(exerciseName)
  if (!benchmark) {
    return { ok: false, message: `未找到「${exerciseName}」的目标记录` }
  }

  const idx = profile.benchmarks.findIndex(b => b.id === benchmark.id)
  const max = targetMax ?? targetMin
  profile.benchmarks[idx] = {
    ...benchmark,
    targetMin: Math.min(targetMin, max),
    targetMax: Math.max(targetMin, max),
    targetWeeks: benchmark.targetWeeks,
  }
  saveAthleteProfile(profile)
  enqueueFeishuAutoSync('athlete_target_updated')
  return { ok: true, benchmark: profile.benchmarks[idx] }
}

export function updatePosition(label: string): { ok: true; position: AthletePosition } | { ok: false; message: string } {
  const position = POSITION_ALIASES[label.trim()]
  if (!position) {
    return { ok: false, message: '请用后卫、前锋或中锋' }
  }
  const profile = touch(getAthleteProfile())
  profile.basics.position = position
  saveAthleteProfile(profile)
  enqueueFeishuAutoSync('athlete_position_updated')
  return { ok: true, position }
}

export function buildAthleteProfileSummary(): string {
  const profile = getAthleteProfile()
  const { basics, preferences, benchmarks } = profile

  const lines: string[] = [
    '个人体能表',
    `年龄 ${basics.age} · 身高 ${basics.heightCm}cm · 体重 ${basics.bodyWeightKg}kg`,
    `运动 ${SPORT_LABELS[basics.sport]} · 位置 ${POSITION_LABELS[basics.position]}`,
    `每周约 ${preferences.weeklyFrequency} 次 · 单次上限 ${preferences.sessionLimitMinutes} 分钟`,
  ]

  if (preferences.priorities.length > 0) {
    const pri = preferences.priorities.map(p => PRIORITY_LABELS[p] ?? p).join('、')
    lines.push(`训练侧重：${pri}`)
  }

  if (basics.notes.trim()) {
    lines.push(`备注：${basics.notes}`)
  }

  lines.push('', '力量目标')
  benchmarks.forEach(b => {
    if (b.kind === 'strength' || b.kind === 'body_metric') {
      lines.push('', fmtBenchmarkProgress(
        b.exerciseName,
        b.currentValue,
        b.targetMin,
        b.targetMax,
        b.unit,
      ))
    } else {
      lines.push(`  ${formatBenchmarkLine(b)}`)
    }
  })

  return lines.join('\n')
}

export function buildGoalsSummary(): string {
  const benchmarks = getAthleteProfile().benchmarks
  if (benchmarks.length === 0) return '暂无训练目标'
  const lines = ['我的目标', '']
  benchmarks.forEach(b => {
    if (b.kind === 'strength' || b.kind === 'body_metric') {
      lines.push(fmtBenchmarkProgress(
        b.exerciseName,
        b.currentValue,
        b.targetMin,
        b.targetMax,
        b.unit,
      ), '')
    } else {
      lines.push(formatBenchmarkLine(b))
    }
  })
  return lines.join('\n').trimEnd()
}

export function buildStrengthLevelsSummary(): string {
  const benchmarks = getAthleteProfile().benchmarks.filter(b => b.kind !== 'body_metric')
  if (benchmarks.length === 0) return '暂无力量水平记录'
  const lines = ['当前力量水平', '']
  benchmarks.forEach(b => {
    if (b.kind === 'weighted_reps' && b.extraWeightKg) {
      lines.push(`  ${b.exerciseName}（负重${b.extraWeightKg}kg）  目标 ${b.targetMin} 次`)
      return
    }
    const unit = b.unit === 'kg' ? 'kg' : '次'
    const current = b.currentValue > 0 ? `${b.currentValue}${unit}` : '未记录'
    lines.push(`  ${b.exerciseName}  ${current}`)
  })
  return lines.join('\n')
}

function formatBenchmarkLine(b: AthleteBenchmark): string {
  const weeks = `约 ${b.targetWeeks} 周`
  if (b.kind === 'body_metric') {
    return `${b.exerciseName}  ${b.currentValue}kg → ${b.targetMin}–${b.targetMax}kg（${weeks}）`
  }
  if (b.kind === 'weighted_reps' && b.extraWeightKg) {
    return `${b.exerciseName}  负重${b.extraWeightKg}kg → ${b.targetMin} 次（${weeks}）`
  }
  const unit = b.unit === 'kg' ? 'kg' : '次'
  const target =
    b.targetMin === b.targetMax
      ? `${b.targetMin}${unit}`
      : `${b.targetMin}–${b.targetMax}${unit}`
  return `${b.exerciseName}  ${b.currentValue}${unit} → ${target}（${weeks}）`
}
