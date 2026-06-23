import type { AttributeKey, Exercise, MuscleMapEntry, XpGain } from './types'

const XP_CAP_PER_EXERCISE = 500

/**
 * 计算升到下一级所需的总 XP
 * xpRequired(level) = 100 × level^1.35
 */
export function xpToNextLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.35))
}

/**
 * 由累计 totalXp 反算当前等级和当前级别内的 xp
 */
export function computeLevelFromTotalXp(totalXp: number): { level: number; xp: number } {
  let level = 1
  let remaining = totalXp
  while (true) {
    const needed = xpToNextLevel(level)
    if (remaining < needed) break
    remaining -= needed
    level++
  }
  return { level, xp: remaining }
}

/**
 * 计算一个 Exercise 对应的 baseXp
 */
function calcBaseXp(exercise: Exercise): number {
  if (exercise.type === 'strength') {
    const weightKg =
      exercise.unit === 'lb' ? exercise.weight * 0.453592 : exercise.weight
    return (exercise.sets * exercise.reps * weightKg) / 10
  } else {
    const dist = exercise.distance ?? 0
    return exercise.duration * 6 + dist * 20
  }
}

/**
 * 根据肌肉映射，计算一个 Exercise 带来的各属性 XP 增益列表
 */
export function calcXpGains(
  exercise: Exercise,
  mapping: MuscleMapEntry | undefined,
): XpGain[] {
  if (!mapping || !mapping.enabled) return []

  const baseXp = Math.min(calcBaseXp(exercise), XP_CAP_PER_EXERCISE)
  const gains: Map<AttributeKey, number> = new Map()

  const addGain = (key: AttributeKey, amount: number) => {
    gains.set(key, (gains.get(key) ?? 0) + amount)
  }

  const primary = mapping.primary
  const secondary = mapping.secondary

  if (primary.length > 0) {
    const perPrimary = (baseXp * 1.0) / primary.length
    primary.forEach(k => addGain(k, perPrimary))
  }

  if (secondary.length > 0) {
    const perSecondary = (baseXp * 0.35) / secondary.length
    secondary.forEach(k => addGain(k, perSecondary))
  }

  return Array.from(gains.entries()).map(([attribute, xp]) => ({
    attribute,
    xp: Math.round(xp),
  }))
}
