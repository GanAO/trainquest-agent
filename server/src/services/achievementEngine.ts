import {
  getAchievementsStore,
  saveAchievementsStore,
} from '../repositories/configRepo'
import { getProfile } from '../repositories/profileRepo'
import { getAllWorkouts } from '../repositories/workoutRepo'
import type { AchievementCondition, AchievementDefinition, WorkoutRecord } from '../domain/types'
import { getWeekKey, getMonthKey } from '../utils/date'

function isoToDate(s: string): Date {
  return new Date(s)
}

function checkCondition(
  condition: AchievementCondition,
  workouts: WorkoutRecord[],
): boolean {
  switch (condition.kind) {
    case 'weekly_workout_count': {
      const currentWeek = getWeekKey(new Date())
      const count = workouts.filter(w => getWeekKey(new Date(w.date)) === currentWeek).length
      return count >= condition.minCount
    }
    case 'monthly_workout_count': {
      const currentMonth = getMonthKey(new Date())
      const count = workouts.filter(w => getMonthKey(new Date(w.date)) === currentMonth).length
      return count >= condition.minCount
    }
    case 'consecutive_weeks': {
      if (workouts.length === 0) return false
      const sorted = [...workouts].sort((a, b) => b.date.localeCompare(a.date))
      const weekCounts: Map<string, number> = new Map()
      for (const w of sorted) {
        const key = getWeekKey(new Date(w.date))
        weekCounts.set(key, (weekCounts.get(key) ?? 0) + 1)
      }
      const today = new Date()
      let consecutive = 0
      for (let i = 0; i < 52; i++) {
        const d = new Date(today)
        d.setDate(d.getDate() - i * 7)
        const key = getWeekKey(d)
        const count = weekCounts.get(key) ?? 0
        if (count >= condition.minPerWeek) {
          consecutive++
        } else {
          break
        }
      }
      return consecutive >= condition.weeks
    }
    case 'return_after_break': {
      if (workouts.length < 2) return false
      const sorted = [...workouts].sort((a, b) => b.date.localeCompare(a.date))
      const latest = sorted[0]
      const second = sorted[1]
      const gap =
        (new Date(latest.date).getTime() - new Date(second.date).getTime()) /
        (1000 * 60 * 60 * 24)
      return gap >= condition.minBreakDays
    }
    case 'exercise_pr': {
      // PR 检测在 workoutService 中实时检测并传递，这里作为通用入口
      return false
    }
    case 'total_volume_kg': {
      let total = 0
      for (const w of workouts) {
        for (const ex of w.exercises) {
          if (ex.type === 'strength') {
            const wkg = ex.unit === 'lb' ? ex.weight * 0.453592 : ex.weight
            total += ex.sets * ex.reps * wkg
          }
        }
      }
      return total >= condition.minVolumeKg
    }
    case 'weight_goal': {
      const profile = getProfile()
      if (profile.goal.type !== condition.goalType) return false
      const target = profile.goal.targetWeightKg
      if (target === null) return false
      const current = profile.body.currentWeightKg
      if (condition.goalType === 'lose_weight') return current <= target
      if (condition.goalType === 'gain_muscle') return current >= target
      return false
    }
  }
}

export function runAchievementCheck(newPrAchievement = false): AchievementDefinition[] {
  const store = getAchievementsStore()
  const workouts = getAllWorkouts()
  const alreadyUnlocked = new Set(store.unlocked.map(u => u.id))
  const newlyUnlocked: AchievementDefinition[] = []

  for (const def of store.definitions) {
    if (!def.enabled) continue
    if (alreadyUnlocked.has(def.id)) continue

    let met = false
    if (def.condition.kind === 'exercise_pr') {
      met = newPrAchievement
    } else {
      met = checkCondition(def.condition, workouts)
    }

    if (met) {
      store.unlocked.push({ id: def.id, unlockedAt: new Date().toISOString() })
      newlyUnlocked.push(def)
    }
  }

  if (newlyUnlocked.length > 0) {
    saveAchievementsStore(store)
  }

  return newlyUnlocked
}
