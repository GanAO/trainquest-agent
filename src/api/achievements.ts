import { api } from './client'
import type { AchievementDefinition } from '../domain/types'

export const achievementsApi = {
  list: () =>
    api.get<{ items: AchievementDefinition[]; unlockedCount: number; totalCount: number }>(
      '/achievements',
    ),
  recalculate: () =>
    api.post<{ newAchievements: AchievementDefinition[] }>('/achievements/recalculate', {}),
}
