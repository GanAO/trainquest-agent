import { getAllWorkouts } from '../repositories/workoutRepo'
import { findMappingByName } from '../repositories/configRepo'
import type { WorkoutRecord } from '../domain/types'
import type { TrainingDraft } from './trainingTextParser'

export function normalizeExerciseNameForDuplicate(name: string): string {
  const trimmed = name.trim()
  return findMappingByName(trimmed)?.exerciseName ?? trimmed
}

function exerciseSignature(ex: WorkoutRecord['exercises'][number] | TrainingDraft['exercises'][number]): string {
  const exerciseName = normalizeExerciseNameForDuplicate(ex.name)
  if (ex.type === 'strength') {
    return [
      ex.type,
      exerciseName,
      ex.sets,
      ex.reps,
      ex.weight,
      ex.unit,
      ex.note.trim(),
    ].join('|')
  }
  return [
    ex.type,
    exerciseName,
    ex.duration,
    ex.distance ?? '',
    ex.distanceUnit ?? '',
    ex.note.trim(),
  ].join('|')
}

function draftSignature(draft: TrainingDraft): string {
  return draft.exercises
    .map(exerciseSignature)
    .sort()
    .join('||')
}

function workoutSignature(workout: WorkoutRecord): string {
  return workout.exercises
    .map(exerciseSignature)
    .sort()
    .join('||')
}

export function findDuplicateWorkoutsForDraft(draft: TrainingDraft): WorkoutRecord[] {
  const signature = draftSignature(draft)
  return getAllWorkouts().filter(workout =>
    workout.date === draft.date &&
    workout.exercises.length === draft.exercises.length &&
    workoutSignature(workout) === signature,
  )
}

export function duplicateWorkoutGroupKey(workout: WorkoutRecord): string {
  return `${workout.date}::${workoutSignature(workout)}`
}

export function formatDuplicateWorkoutLine(workout: WorkoutRecord): string {
  const exercises = workout.exercises.map(ex => {
    if (ex.type === 'strength') {
      const weight = ex.weight > 0 ? ` ${ex.weight}${ex.unit}` : ''
      return `${ex.name} ${ex.sets}x${ex.reps}${weight}`
    }
    const distance = ex.distance != null ? ` ${ex.distance}${ex.distanceUnit ?? 'km'}` : ''
    return `${ex.name} ${ex.duration}分钟${distance}`
  }).join('、')
  return `${workout.date} ${exercises}`
}
