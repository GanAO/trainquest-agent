import {
  buildAthleteProfileSummary,
  buildGoalsSummary,
  buildStrengthLevelsSummary,
  updateBodyWeight,
  updateBenchmarkTarget,
  updatePosition,
} from './athleteProfileService'

export type AthleteCommandType =
  | 'query_profile'
  | 'query_goals'
  | 'query_strength'
  | 'update_weight'
  | 'update_benchmark_target'
  | 'update_position'

export interface AthleteCommand {
  type: AthleteCommandType
  weightKg?: number
  exerciseName?: string
  targetMin?: number
  targetMax?: number
  positionLabel?: string
}

const PROFILE_PATTERNS = [/^查看体能表$/, /^我的体能表$/, /^个人档案$/, /^个人体能表$/]
const GOALS_PATTERNS = [/^我的目标$/, /^训练目标$/]
const STRENGTH_PATTERNS = [/^查看力量水平$/, /^力量水平$/]

export function parseAthleteCommand(text: string): AthleteCommand | null {
  const t = text.trim()

  if (PROFILE_PATTERNS.some(p => p.test(t))) return { type: 'query_profile' }
  if (GOALS_PATTERNS.some(p => p.test(t))) return { type: 'query_goals' }
  if (STRENGTH_PATTERNS.some(p => p.test(t))) return { type: 'query_strength' }

  const weightMatch = t.match(/^更新体重\s*(\d+(?:\.\d+)?)\s*(?:kg|公斤)?$/i)
  if (weightMatch) {
    return { type: 'update_weight', weightKg: parseFloat(weightMatch[1]) }
  }

  const benchTargetRange = t.match(
    /^(?:设置)?(.+?)目标\s*(\d+(?:\.\d+)?)\s*[-–~到]\s*(\d+(?:\.\d+)?)\s*(?:kg|公斤|次)?$/i,
  )
  if (benchTargetRange) {
    return {
      type: 'update_benchmark_target',
      exerciseName: benchTargetRange[1].trim(),
      targetMin: parseFloat(benchTargetRange[2]),
      targetMax: parseFloat(benchTargetRange[3]),
    }
  }

  const benchTargetSingle = t.match(
    /^(?:设置)?(.+?)目标\s*(\d+(?:\.\d+)?)\s*(?:kg|公斤|次)?$/i,
  )
  if (benchTargetSingle) {
    const val = parseFloat(benchTargetSingle[2])
    return {
      type: 'update_benchmark_target',
      exerciseName: benchTargetSingle[1].trim(),
      targetMin: val,
      targetMax: val,
    }
  }

  const positionMatch = t.match(/^(?:设置)?(?:篮球)?位置\s*(?:改成|为|是)?\s*(后卫|控卫|前锋|中锋)$/)
  if (positionMatch) {
    return { type: 'update_position', positionLabel: positionMatch[1] }
  }

  return null
}

export function handleAthleteCommand(cmd: AthleteCommand): string {
  switch (cmd.type) {
    case 'query_profile':
      return buildAthleteProfileSummary()

    case 'query_goals':
      return buildGoalsSummary()

    case 'query_strength':
      return buildStrengthLevelsSummary()

    case 'update_weight': {
      if (cmd.weightKg == null || cmd.weightKg <= 0 || cmd.weightKg > 300) {
        return '体重数值不合理，请说「更新体重 65kg」'
      }
      updateBodyWeight(cmd.weightKg)
      return `已更新体重为 ${cmd.weightKg}kg`
    }

    case 'update_benchmark_target': {
      if (!cmd.exerciseName || cmd.targetMin == null) {
        return '请说「设置深蹲目标 90kg」或「深蹲目标 85-90kg」'
      }
      const result = updateBenchmarkTarget(cmd.exerciseName, cmd.targetMin, cmd.targetMax)
      if (!result.ok) return result.message
      const b = result.benchmark
      const unit = b.unit === 'kg' ? 'kg' : '次'
      const target =
        b.targetMin === b.targetMax
          ? `${b.targetMin}${unit}`
          : `${b.targetMin}–${b.targetMax}${unit}`
      return `已更新「${b.exerciseName}」目标为 ${target}`
    }

    case 'update_position': {
      if (!cmd.positionLabel) return '请说「设置篮球位置 后卫」'
      const result = updatePosition(cmd.positionLabel)
      if (!result.ok) return result.message
      const labels: Record<string, string> = { guard: '后卫', forward: '前锋', center: '中锋' }
      return `已更新位置为 ${labels[result.position]}`
    }

    default:
      return '未识别的体能表命令'
  }
}
