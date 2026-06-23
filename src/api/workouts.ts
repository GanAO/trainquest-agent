import { api } from './client'
import type { WorkoutRecord, WorkoutProcessResult, FeelingType, Exercise } from '../domain/types'

export interface CreateWorkoutPayload {
  date: string
  exercises: Omit<Exercise, 'id'>[]
  duration?: number
  feeling: FeelingType
}

export const workoutsApi = {
  list: (from?: string, to?: string) => {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const qs = params.toString()
    return api.get<{ items: WorkoutRecord[]; total: number }>(`/workouts${qs ? `?${qs}` : ''}`)
  },
  get: (id: string) => api.get<WorkoutRecord>(`/workouts/${id}`),
  create: (payload: CreateWorkoutPayload) =>
    api.post<WorkoutProcessResult>('/workouts', payload),
  delete: (id: string) => api.delete<{ success: boolean }>(`/workouts/${id}`),
}
