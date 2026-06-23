export type MissingFieldName = 'sets' | 'reps' | 'duration'
export type ExerciseType = 'strength' | 'cardio'

const HIGH_REP_KEYWORDS = [
  '平板支撑',
  '跳绳',
  '卷腹',
  '仰卧起坐',
  '开合跳',
  '波比',
  '深蹲跳',
  '俯卧撑',
]

export function isHighRepExercise(exerciseName: string): boolean {
  return HIGH_REP_KEYWORDS.some(k => exerciseName.includes(k))
}

export function getMissingFieldRange(
  fieldName: MissingFieldName,
  exerciseName: string,
  exerciseType: ExerciseType,
): { min: number; max: number } {
  if (fieldName === 'sets') {
    return { min: 1, max: 30 }
  }
  if (fieldName === 'duration') {
    return { min: 1, max: 600 }
  }
  // reps
  if (exerciseType === 'cardio') {
    return { min: 1, max: 600 }
  }
  if (isHighRepExercise(exerciseName)) {
    return { min: 1, max: 999 }
  }
  return { min: 1, max: 100 }
}

export function buildMissingFieldErrorHint(
  fieldName: MissingFieldName,
  range: { min: number; max: number },
  exerciseName: string,
  exerciseType: ExerciseType,
): string {
  if (fieldName === 'sets') {
    return `没理解，请告诉我 ${range.min}–${range.max} 之间的组数，比如 3组`
  }
  if (fieldName === 'duration') {
    return '没理解，请告诉我分钟数，比如 30分钟'
  }
  if (exerciseType === 'strength' && isHighRepExercise(exerciseName)) {
    return '没理解，请告诉我一个合理数字，比如 120次'
  }
  return `没理解，请告诉我 ${range.min}–${range.max} 之间的次数，比如 8次`
}
