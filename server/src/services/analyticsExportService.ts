import { getAllWorkouts } from '../repositories/workoutRepo'
import { getAttributesStore, getAchievementsStore, findMappingByName } from '../repositories/configRepo'
import { ATTRIBUTE_LABELS } from '../domain/defaults'
import type { AttributeKey, CardioExercise, StrengthExercise, WorkoutRecord } from '../domain/types'

type Row = Record<string, string | number | boolean | null>

export interface FeishuBaseExport {
  workouts: Row[]
  exerciseLogs: Row[]
  attributes: Row[]
  achievements: Row[]
  dailySummary: Row[]
}

export interface FeishuExportCounts {
  workouts: number
  exerciseLogs: number
  attributes: number
  achievements: number
  dailySummary: number
}

const ATTRIBUTE_ORDER: AttributeKey[] = ['chest', 'shoulders', 'back', 'legs', 'arms', 'core', 'cardio']

function asDateTime(date: string): string {
  return `${date} 00:00:00`
}

function toKg(weight: number, unit: 'kg' | 'lb'): number {
  return unit === 'lb' ? weight * 0.453592 : weight
}

function strengthVolume(ex: StrengthExercise): number {
  return Math.round(ex.sets * ex.reps * toKg(ex.weight, ex.unit) * 100) / 100
}

function exerciseVolume(ex: WorkoutRecord['exercises'][number]): number {
  return ex.type === 'strength' ? strengthVolume(ex as StrengthExercise) : 0
}

function exerciseCardioMinutes(ex: WorkoutRecord['exercises'][number]): number {
  return ex.type === 'cardio' ? (ex as CardioExercise).duration : 0
}

function exerciseDistance(ex: WorkoutRecord['exercises'][number]): number {
  if (ex.type !== 'cardio') return 0
  return (ex as CardioExercise).distance ?? 0
}

function muscleLabels(keys: AttributeKey[]): string {
  return keys.map(k => ATTRIBUTE_LABELS[k] ?? k).join('、')
}

function workoutMuscles(workout: WorkoutRecord): string {
  const keys = new Set<AttributeKey>()
  workout.exercises.forEach(ex => {
    const mapping = findMappingByName(ex.name)
    mapping?.primary.forEach(k => keys.add(k))
  })
  return muscleLabels(Array.from(keys))
}

function workoutTitle(workout: WorkoutRecord): string {
  const names = workout.exercises.map(ex => ex.name).join('、')
  return `${workout.date} ${names || '训练'}`
}

function buildWorkoutRows(workouts: WorkoutRecord[]): Row[] {
  return workouts.map(workout => {
    const totalVolumeKg = workout.exercises.reduce((sum, ex) => sum + exerciseVolume(ex), 0)
    const cardioMinutes = workout.exercises.reduce((sum, ex) => sum + exerciseCardioMinutes(ex), 0)
    const cardioDistance = workout.exercises.reduce((sum, ex) => sum + exerciseDistance(ex), 0)
    return {
      训练标题: workoutTitle(workout),
      'Workout ID': workout.id,
      日期: asDateTime(workout.date),
      来源: workout.source,
      状态感受: workout.feeling,
      动作数: workout.exercises.length,
      '力量容量 kg': Math.round(totalVolumeKg * 100) / 100,
      有氧分钟: cardioMinutes,
      有氧距离: Math.round(cardioDistance * 100) / 100,
      本次主肌群: workoutMuscles(workout),
      创建时间: workout.createdAt.replace('T', ' ').slice(0, 19),
    }
  })
}

function buildExerciseRows(workouts: WorkoutRecord[]): Row[] {
  return workouts.flatMap(workout =>
    workout.exercises.map(ex => {
      const mapping = findMappingByName(ex.name)
      const title = `${workout.date} ${ex.name}`
      if (ex.type === 'strength') {
        const s = ex as StrengthExercise
        return {
          动作标题: title,
          'Exercise ID': s.id,
          'Workout ID': workout.id,
          日期: asDateTime(workout.date),
          动作名: s.name,
          类型: s.type,
          组数: s.sets,
          次数: s.reps,
          重量: s.weight,
          单位: s.unit,
          '训练容量 kg': strengthVolume(s),
          时长分钟: null,
          距离: null,
          备注: s.note,
          主肌群: mapping ? muscleLabels(mapping.primary) : '',
          次肌群: mapping ? muscleLabels(mapping.secondary) : '',
          来源: workout.source,
        }
      }
      const c = ex as CardioExercise
      return {
        动作标题: title,
        'Exercise ID': c.id,
        'Workout ID': workout.id,
        日期: asDateTime(workout.date),
        动作名: c.name,
        类型: c.type,
        组数: null,
        次数: null,
        重量: null,
        单位: '',
        '训练容量 kg': 0,
        时长分钟: c.duration,
        距离: c.distance ?? null,
        备注: c.note,
        主肌群: mapping ? muscleLabels(mapping.primary) : '',
        次肌群: mapping ? muscleLabels(mapping.secondary) : '',
        来源: workout.source,
      }
    }),
  )
}

function buildAttributeRows(): Row[] {
  const store = getAttributesStore()
  return ATTRIBUTE_ORDER.map(key => {
    const state = store.items[key]
    return {
      属性: ATTRIBUTE_LABELS[key] ?? key,
      属性键: key,
      等级: state.level,
      当前XP: state.xp,
      累计XP: state.totalXp,
      最近变化时间: state.lastChangedAt ? state.lastChangedAt.replace('T', ' ').slice(0, 19) : null,
    }
  })
}

function buildAchievementRows(): Row[] {
  const store = getAchievementsStore()
  const unlocked = new Map(store.unlocked.map(item => [item.id, item.unlockedAt]))
  return store.definitions.map(def => ({
    成就名称: def.name,
    'Achievement ID': def.id,
    类型: def.type,
    描述: def.description,
    是否解锁: unlocked.has(def.id),
    解锁时间: unlocked.get(def.id)?.replace('T', ' ').slice(0, 19) ?? null,
    触发条件: def.condition.kind,
  }))
}

function buildDailySummaryRows(workouts: WorkoutRecord[]): Row[] {
  const byDate = new Map<string, {
    workoutCount: number
    exerciseCount: number
    volumeKg: number
    cardioMinutes: number
    cardioDistance: number
    muscles: Set<string>
    exerciseNames: Set<string>
  }>()

  workouts.forEach(workout => {
    const entry = byDate.get(workout.date) ?? {
      workoutCount: 0,
      exerciseCount: 0,
      volumeKg: 0,
      cardioMinutes: 0,
      cardioDistance: 0,
      muscles: new Set<string>(),
      exerciseNames: new Set<string>(),
    }
    entry.workoutCount += 1
    entry.exerciseCount += workout.exercises.length
    workout.exercises.forEach(ex => {
      entry.volumeKg += exerciseVolume(ex)
      entry.cardioMinutes += exerciseCardioMinutes(ex)
      entry.cardioDistance += exerciseDistance(ex)
      entry.exerciseNames.add(ex.name)
      const mapping = findMappingByName(ex.name)
      mapping?.primary.forEach(k => entry.muscles.add(ATTRIBUTE_LABELS[k] ?? k))
    })
    byDate.set(workout.date, entry)
  })

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, entry]) => ({
      日期: asDateTime(date),
      训练次数: entry.workoutCount,
      动作数: entry.exerciseCount,
      '力量容量 kg': Math.round(entry.volumeKg * 100) / 100,
      有氧分钟: entry.cardioMinutes,
      有氧距离: Math.round(entry.cardioDistance * 100) / 100,
      涉及肌群: Array.from(entry.muscles).join('、'),
      主要动作: Array.from(entry.exerciseNames).join('、'),
    }))
}

export function buildFeishuBaseExport(): FeishuBaseExport {
  const workouts = getAllWorkouts().slice().sort((a, b) => a.date.localeCompare(b.date))
  return {
    workouts: buildWorkoutRows(workouts),
    exerciseLogs: buildExerciseRows(workouts),
    attributes: buildAttributeRows(),
    achievements: buildAchievementRows(),
    dailySummary: buildDailySummaryRows(workouts),
  }
}

export function getFeishuExportCounts(data: FeishuBaseExport): FeishuExportCounts {
  return {
    workouts: data.workouts.length,
    exerciseLogs: data.exerciseLogs.length,
    attributes: data.attributes.length,
    achievements: data.achievements.length,
    dailySummary: data.dailySummary.length,
  }
}
