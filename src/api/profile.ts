import { api } from './client'
import type { ProfileStore } from '../domain/types'

export const profileApi = {
  get: () => api.get<ProfileStore>('/profile'),
  update: (data: Partial<ProfileStore>) => api.put<ProfileStore>('/profile', data),
  addWeightLog: (date: string, weightKg: number) =>
    api.post<{ success: boolean }>('/profile/weight-logs', { date, weightKg }),
}
