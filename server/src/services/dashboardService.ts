import { getAllWorkouts } from '../repositories/workoutRepo'
import { getProfile } from '../repositories/profileRepo'
import { getAttributesStore } from '../repositories/configRepo'
import type { DashboardData, AttributeKey } from '../domain/types'
import { ALL_ATTRIBUTES } from '../domain/defaults'

export function getDashboardData(from?: string, to?: string): DashboardData {
  const allWorkouts = getAllWorkouts()
  const profile = getProfile()
  const attrStore = getAttributesStore()

  // 过滤日期范围
  const workouts = allWorkouts.filter(w => {
    if (from && w.date < from) return false
    if (to && w.date > to) return false
    return true
  })

  // 体重趋势
  const weightTrend = profile.body.weightLogs.filter(l => {
    if (from && l.date < from) return false
    if (to && l.date > to) return false
    return true
  })

  // 训练频率（按日期聚合）
  const freqMap: Map<string, number> = new Map()
  for (const w of workouts) {
    freqMap.set(w.date, (freqMap.get(w.date) ?? 0) + 1)
  }
  const workoutFrequency = Array.from(freqMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }))

  // 肌群分布
  const muscleDistribution = ALL_ATTRIBUTES.map((attr: AttributeKey) => ({
    attribute: attr,
    totalXp: attrStore.items[attr]?.totalXp ?? 0,
    level: attrStore.items[attr]?.level ?? 1,
  }))

  // 目标进度
  const current = profile.body.currentWeightKg
  const target = profile.goal.targetWeightKg
  let progressPct = 0
  if (target !== null && profile.goal.type !== 'maintain') {
    const startWeight = profile.body.weightLogs[0]?.weightKg ?? current
    if (profile.goal.type === 'lose_weight') {
      const total = startWeight - target
      const done = startWeight - current
      progressPct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
    } else if (profile.goal.type === 'gain_muscle') {
      const total = target - startWeight
      const done = current - startWeight
      progressPct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
    }
  }

  // 累计训练量（吨）
  let totalVolumeKg = 0
  for (const w of allWorkouts) {
    for (const ex of w.exercises) {
      if (ex.type === 'strength') {
        const wkg = ex.unit === 'lb' ? ex.weight * 0.453592 : ex.weight
        totalVolumeKg += ex.sets * ex.reps * wkg
      }
    }
  }

  return {
    weightTrend,
    workoutFrequency,
    muscleDistribution,
    goalProgress: {
      goalType: profile.goal.type,
      currentWeightKg: current,
      targetWeightKg: target,
      progressPct,
    },
    recentWorkouts: workouts.slice(0, 10),
    totalWorkouts: allWorkouts.length,
    totalVolumeTons: totalVolumeKg / 1000,
  }
}
