import { api } from './client'
import type { FeelingType, Exercise } from '../domain/types'

export interface TrainingDraft {
  date: string
  feeling: FeelingType
  exercises: Omit<Exercise, 'id'>[]
}

export interface ParseResult {
  rawText: string
  draft: TrainingDraft
  warnings: string[]
}

export const intakeApi = {
  parse: (text: string) => api.post<ParseResult>('/intake/parse', { text }),
}
