import { getAllWorkouts } from '../repositories/workoutRepo'
import type { WorkoutRecord } from '../domain/types'
import { fmtRecentWorkouts, fmtTodayWorkouts, fmtLastExercise } from './feishuFormatter'

/** 本地自然日（Asia/Shanghai），格式 YYYY-MM-DD */
export function localToday(): string {
  return new Date().toLocaleDateString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/\//g, '-')
}

/** 显式按 date desc、createdAt desc 排序 */
export function sortedWorkouts(): WorkoutRecord[] {
  return getAllWorkouts().slice().sort((a, b) => {
    const byDate = new Date(b.date).getTime() - new Date(a.date).getTime()
    if (byDate !== 0) return byDate
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

export function getRecentWorkouts(n = 3): string {
  return fmtRecentWorkouts(sortedWorkouts().slice(0, n))
}

export function getTodayWorkouts(): string {
  const today = localToday()
  return fmtTodayWorkouts(sortedWorkouts().filter(w => w.date === today), today)
}

export function getWorkoutsWithExercise(exerciseName: string, limit = 5): WorkoutRecord[] {
  const name = exerciseName.trim().toLowerCase()
  return sortedWorkouts()
    .filter(w => w.exercises.some(ex => ex.name.toLowerCase().includes(name)))
    .slice(0, limit)
}

export function getLastExercise(exerciseName: string): string {
  const recent = getWorkoutsWithExercise(exerciseName, 5)
  if (recent.length === 0) return `暂无「${exerciseName}」的训练记录`
  return fmtLastExercise(exerciseName, recent[0], recent)
}
