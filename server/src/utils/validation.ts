export function isValidDate(s: unknown): s is string {
  if (typeof s !== 'string') return false
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime())
}

export function isValidFeeling(s: unknown): boolean {
  return ['great', 'good', 'ok', 'tired', 'bad'].includes(s as string)
}

export function isPositiveNumber(n: unknown): n is number {
  return typeof n === 'number' && n > 0 && isFinite(n)
}

export function isNonNegativeNumber(n: unknown): n is number {
  return typeof n === 'number' && n >= 0 && isFinite(n)
}

export function validateWorkoutInput(body: Record<string, unknown>): string[] {
  const errors: string[] = []

  if (!isValidDate(body.date)) errors.push('date 必须为 YYYY-MM-DD 格式')
  if (!isValidFeeling(body.feeling)) errors.push('feeling 必须为 great/good/ok/tired/bad 之一')
  if (!Array.isArray(body.exercises) || body.exercises.length === 0) {
    errors.push('exercises 不能为空')
    return errors
  }

  ;(body.exercises as unknown[]).forEach((ex, i) => {
    const e = ex as Record<string, unknown>
    if (typeof e.name !== 'string' || !e.name.trim()) {
      errors.push(`exercises[${i}].name 不能为空`)
    }
    if (e.type === 'strength') {
      if (!isPositiveNumber(e.sets)) errors.push(`exercises[${i}].sets 必须为正整数`)
      if (!isPositiveNumber(e.reps)) errors.push(`exercises[${i}].reps 必须为正整数`)
      if (!isNonNegativeNumber(e.weight)) errors.push(`exercises[${i}].weight 必须为非负数`)
    } else if (e.type === 'cardio') {
      if (!isPositiveNumber(e.duration)) errors.push(`exercises[${i}].duration 必须为正数（分钟）`)
    } else {
      errors.push(`exercises[${i}].type 必须为 strength 或 cardio`)
    }
  })

  return errors
}
