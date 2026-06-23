import { v4 as uuidv4 } from 'uuid'
import { saveWorkout, getAllWorkouts } from '../repositories/workoutRepo'
import { findMappingByName } from '../repositories/configRepo'
import { calcXpGains } from '../domain/formulas'
import { applyXpGains } from './attributeService'
import { runAchievementCheck } from './achievementEngine'
import { enqueueFeishuAutoSync } from './feishuAutoSyncService'
import type {
  WorkoutRecord,
  Exercise,
  FeelingType,
  WorkoutProcessResult,
  XpGain,
} from '../domain/types'

export interface CreateWorkoutInput {
  date: string
  exercises: Omit<Exercise, 'id'>[]
  duration?: number
  feeling: FeelingType
  source?: 'manual' | 'chat' | 'feishu'
}

function detectNewPr(exercises: Exercise[], existingWorkouts: WorkoutRecord[]): boolean {
  for (const ex of exercises) {
    if (ex.type !== 'strength') continue
    const currentWeight = ex.unit === 'lb' ? ex.weight * 0.453592 : ex.weight

    let historicalMax = 0
    for (const w of existingWorkouts) {
      for (const e of w.exercises) {
        if (e.type === 'strength' && e.name === ex.name) {
          const wkg = e.unit === 'lb' ? e.weight * 0.453592 : e.weight
          if (wkg > historicalMax) historicalMax = wkg
        }
      }
    }
    if (currentWeight > historicalMax && historicalMax > 0) return true
  }
  return false
}

export function createWorkout(input: CreateWorkoutInput): WorkoutProcessResult {
  const existingWorkouts = getAllWorkouts()

  const exercises: Exercise[] = input.exercises.map(ex => ({
    ...ex,
    id: `e_${uuidv4().slice(0, 8)}`,
  })) as Exercise[]

  const workout: WorkoutRecord = {
    id: `w_${new Date(input.date).toISOString().slice(0, 10).replace(/-/g, '')}_${uuidv4().slice(0, 6)}`,
    source: input.source ?? 'manual',
    date: input.date,
    duration: input.duration,
    feeling: input.feeling,
    exercises,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  // 计算 XP
  const allXpGains: XpGain[] = []
  for (const ex of exercises) {
    const mapping = findMappingByName(ex.name)
    const gains = calcXpGains(ex, mapping)
    allXpGains.push(...gains)
  }

  // 检测 PR
  const isNewPr = detectNewPr(exercises, existingWorkouts)

  // 保存训练
  saveWorkout(workout)

  // 更新属性
  const levelUps = applyXpGains(allXpGains, workout.id)

  // 检测成就
  const newAchievements = runAchievementCheck(isNewPr)

  enqueueFeishuAutoSync('workout_created')

  return {
    workout,
    xpGains: allXpGains,
    levelUps,
    newAchievements,
  }
}
