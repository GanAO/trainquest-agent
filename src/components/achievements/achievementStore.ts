import { create } from 'zustand'
import type { AchievementDefinition } from '../../domain/types'

interface AchievementStore {
  queue: AchievementDefinition[]
  push: (achievements: AchievementDefinition[]) => void
  dismiss: (id: string) => void
}

export const useAchievementStore = create<AchievementStore>((set) => ({
  queue: [],
  push: (achievements) =>
    set(state => ({ queue: [...state.queue, ...achievements] })),
  dismiss: (id) =>
    set(state => ({ queue: state.queue.filter(a => a.id !== id) })),
}))
