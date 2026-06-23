import { computeLevelFromTotalXp } from '../domain/formulas'
import {
  getAttributesStore,
  saveAttributesStore,
} from '../repositories/configRepo'
import type { AttributeKey, LevelUpEvent, XpGain, AttributesStore } from '../domain/types'
import { defaultAttributesStore } from '../domain/defaults'

export function getAttributes(): AttributesStore {
  return getAttributesStore()
}

export function applyXpGains(
  xpGains: XpGain[],
  workoutId: string,
): LevelUpEvent[] {
  const store = getAttributesStore()
  const levelUps: LevelUpEvent[] = []

  for (const gain of xpGains) {
    const state = store.items[gain.attribute as AttributeKey]
    if (!state) continue

    const fromLevel = state.level
    state.totalXp += gain.xp

    const { level, xp } = computeLevelFromTotalXp(state.totalXp)
    state.level = level
    state.xp = xp
    state.lastChangedAt = new Date().toISOString()

    if (level > fromLevel) {
      levelUps.push({ attribute: gain.attribute as AttributeKey, fromLevel, toLevel: level })
    }
  }

  store.lastWorkoutIdApplied = workoutId
  saveAttributesStore(store)
  return levelUps
}

export function recalculateFromWorkouts(workouts: import('../domain/types').WorkoutRecord[]): void {
  const fresh = defaultAttributesStore()
  saveAttributesStore(fresh)

  const { calcXpGains } = require('../domain/formulas')
  const { findMappingByName } = require('../repositories/configRepo')

  for (const workout of [...workouts].sort((a, b) => a.date.localeCompare(b.date))) {
    const xpGains: XpGain[] = []
    for (const ex of workout.exercises) {
      const mapping = findMappingByName(ex.name)
      const gains = calcXpGains(ex, mapping)
      xpGains.push(...gains)
    }
    applyXpGains(xpGains, workout.id)
  }
}
