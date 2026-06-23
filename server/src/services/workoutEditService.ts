import { getAllWorkouts, getWorkoutById, saveWorkout } from '../repositories/workoutRepo'
import { recalculateFromWorkouts } from './attributeService'
import { runAchievementCheck } from './achievementEngine'
import { enqueueFeishuAutoSync } from './feishuAutoSyncService'
import { isValidDate, isValidFeeling } from '../utils/validation'
import type {
  CardioExercise,
  Exercise,
  FeelingType,
  StrengthExercise,
  WorkoutRecord,
} from '../domain/types'

type StrengthExerciseInput = Omit<StrengthExercise, 'id'> | StrengthExercise
type CardioExerciseInput = Omit<CardioExercise, 'id'> | CardioExercise

export type WorkoutEditOperation =
  | { type: 'set_date'; value: string }
  | { type: 'set_feeling'; value: FeelingType }
  | { type: 'set_exercise_field'; exerciseName?: string; field: 'sets' | 'reps' | 'weight' | 'duration'; value: number }
  | { type: 'set_exercise_note'; exerciseName?: string; value: string }
  | { type: 'remove_exercise'; exerciseName?: string }
  | { type: 'add_exercise'; exercise: Omit<Exercise, 'id'> }

export interface WorkoutEditPatch {
  operations: WorkoutEditOperation[]
}

export interface WorkoutEditResult {
  workout: WorkoutRecord
  before: WorkoutRecord
  changedFields: string[]
  newAchievements: ReturnType<typeof runAchievementCheck>
}

function cloneWorkout(workout: WorkoutRecord): WorkoutRecord {
  return JSON.parse(JSON.stringify(workout)) as WorkoutRecord
}

function isPositiveNumber(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

function isNonNegativeNumber(value: number): boolean {
  return Number.isFinite(value) && value >= 0
}

function validateExercise(exercise: Omit<Exercise, 'id'> | Exercise, label: string): string[] {
  const errors: string[] = []
  if (!exercise.name.trim()) errors.push(`${label} 动作名不能为空`)
  if (exercise.type === 'strength') {
    const strength = exercise as StrengthExerciseInput
    if (!isPositiveNumber(strength.sets)) errors.push(`${label} 组数必须为正数`)
    if (!isPositiveNumber(strength.reps)) errors.push(`${label} 次数必须为正数`)
    if (!isNonNegativeNumber(strength.weight)) errors.push(`${label} 重量必须为非负数`)
  } else {
    const cardio = exercise as CardioExerciseInput
    if (!isPositiveNumber(cardio.duration)) errors.push(`${label} 时长必须为正数`)
    if (cardio.distance != null && !isNonNegativeNumber(cardio.distance)) {
      errors.push(`${label} 距离必须为非负数`)
    }
  }
  return errors
}

function validateWorkout(workout: WorkoutRecord): string[] {
  const errors: string[] = []
  if (!isValidDate(workout.date)) errors.push('日期必须为 YYYY-MM-DD')
  if (!isValidFeeling(workout.feeling)) errors.push('状态感受不合法')
  if (workout.exercises.length === 0) errors.push('训练记录至少需要保留一个动作')
  workout.exercises.forEach((exercise, index) => {
    errors.push(...validateExercise(exercise, `动作${index + 1}`))
  })
  return errors
}

function matchExerciseIndexes(workout: WorkoutRecord, exerciseName?: string): number[] {
  if (!exerciseName?.trim()) {
    return workout.exercises.length === 1 ? [0] : []
  }
  const needle = exerciseName.trim().toLowerCase()
  return workout.exercises
    .map((exercise, index) => ({ exercise, index }))
    .filter(({ exercise }) => exercise.name.toLowerCase().includes(needle) || needle.includes(exercise.name.toLowerCase()))
    .map(({ index }) => index)
}

function getSingleExerciseIndex(workout: WorkoutRecord, exerciseName?: string): number {
  const matches = matchExerciseIndexes(workout, exerciseName)
  if (matches.length === 1) return matches[0]
  if (matches.length === 0) {
    throw new Error(exerciseName ? `没有找到动作「${exerciseName}」` : '请指定要修改哪个动作')
  }
  throw new Error(`找到多个「${exerciseName}」动作，请说得更具体一点`)
}

function nextExerciseId(workout: WorkoutRecord): string {
  return `e_${workout.id.slice(-6)}_${workout.exercises.length + 1}_${Date.now().toString(36).slice(-4)}`
}

function applyOperation(workout: WorkoutRecord, op: WorkoutEditOperation): string {
  switch (op.type) {
    case 'set_date':
      workout.date = op.value
      return `日期改为 ${op.value}`

    case 'set_feeling':
      workout.feeling = op.value
      return `状态感受改为 ${op.value}`

    case 'set_exercise_field': {
      const index = getSingleExerciseIndex(workout, op.exerciseName)
      const exercise = workout.exercises[index]
      if (exercise.type === 'strength') {
        if (op.field === 'sets') (exercise as StrengthExercise).sets = op.value
        else if (op.field === 'reps') (exercise as StrengthExercise).reps = op.value
        else if (op.field === 'weight') (exercise as StrengthExercise).weight = op.value
        else throw new Error(`${exercise.name} 不是有氧动作，不能修改时长`)
      } else {
        if (op.field === 'duration') (exercise as CardioExercise).duration = op.value
        else throw new Error(`${exercise.name} 不是力量动作，不能修改 ${op.field}`)
      }
      return `${exercise.name} ${op.field} 改为 ${op.value}`
    }

    case 'set_exercise_note': {
      const index = getSingleExerciseIndex(workout, op.exerciseName)
      workout.exercises[index].note = op.value
      return `${workout.exercises[index].name} 备注改为 ${op.value}`
    }

    case 'remove_exercise': {
      const index = getSingleExerciseIndex(workout, op.exerciseName)
      const [removed] = workout.exercises.splice(index, 1)
      return `删除动作 ${removed.name}`
    }

    case 'add_exercise': {
      const exercise = { ...op.exercise, id: nextExerciseId(workout) } as Exercise
      workout.exercises.push(exercise)
      return `新增动作 ${exercise.name}`
    }
  }
}

export function updateWorkout(workoutId: string, patch: WorkoutEditPatch): WorkoutEditResult {
  const current = getWorkoutById(workoutId)
  if (!current) throw new Error('训练记录不存在')
  if (!Array.isArray(patch.operations) || patch.operations.length === 0) {
    throw new Error('没有可修改的内容')
  }

  const before = cloneWorkout(current)
  const next = cloneWorkout(current)
  const changedFields = patch.operations.map(op => applyOperation(next, op))
  next.updatedAt = new Date().toISOString()

  const errors = validateWorkout(next)
  if (errors.length > 0) throw new Error(errors.join('；'))

  saveWorkout(next)
  recalculateFromWorkouts(getAllWorkouts())
  const newAchievements = runAchievementCheck(false)
  enqueueFeishuAutoSync('workout_updated')

  return { workout: next, before, changedFields, newAchievements }
}

export function isSimpleWorkoutEdit(patch: WorkoutEditPatch): boolean {
  if (patch.operations.length !== 1) return false
  const op = patch.operations[0]
  return op.type === 'set_date' ||
    op.type === 'set_feeling' ||
    op.type === 'set_exercise_field' ||
    op.type === 'set_exercise_note'
}
