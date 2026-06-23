import { readJson, writeJson } from './jsonStore'
import { defaultMuscleMapStore, defaultAchievementsStore } from '../domain/defaults'
import type { MuscleMapStore, MuscleMapEntry, AchievementsStore, AttributeKey, AttributesStore } from '../domain/types'
import { defaultAttributesStore } from '../domain/defaults'

// ─── Muscle Map ───────────────────────────────────────────────────────────────
const MUSCLE_MAP_FILE = 'muscle-map.json'

export function getMuscleMapStore(): MuscleMapStore {
  return readJson<MuscleMapStore>(MUSCLE_MAP_FILE, defaultMuscleMapStore())
}

export function saveMuscleMapStore(store: MuscleMapStore): void {
  writeJson(MUSCLE_MAP_FILE, store)
}

export function findMappingByName(name: string): MuscleMapEntry | undefined {
  const normalized = name.trim().toLowerCase()
  const store = getMuscleMapStore()
  return store.items.find(
    entry =>
      entry.enabled &&
      (entry.exerciseName.toLowerCase() === normalized ||
        entry.aliases.some(a => a.toLowerCase() === normalized)),
  )
}

// ─── Achievements ─────────────────────────────────────────────────────────────
const ACHIEVEMENTS_FILE = 'achievements.json'

export function getAchievementsStore(): AchievementsStore {
  return readJson<AchievementsStore>(ACHIEVEMENTS_FILE, defaultAchievementsStore())
}

export function saveAchievementsStore(store: AchievementsStore): void {
  writeJson(ACHIEVEMENTS_FILE, store)
}

// ─── Attributes ───────────────────────────────────────────────────────────────
const ATTRIBUTES_FILE = 'attributes.json'

export function getAttributesStore(): AttributesStore {
  return readJson<AttributesStore>(ATTRIBUTES_FILE, defaultAttributesStore())
}

export function saveAttributesStore(store: AttributesStore): void {
  writeJson(ATTRIBUTES_FILE, store)
}

export function applyXpGain(attribute: AttributeKey, xp: number): { levelUp: boolean; fromLevel: number; toLevel: number } {
  const store = getAttributesStore()
  const state = store.items[attribute]
  const fromLevel = state.level

  state.totalXp += xp

  // 重新计算等级
  const { computeLevelFromTotalXp } = require('../domain/formulas')
  const { level, xp: currentXp } = computeLevelFromTotalXp(state.totalXp)
  state.level = level
  state.xp = currentXp
  state.lastChangedAt = new Date().toISOString()

  saveAttributesStore(store)
  return { levelUp: level > fromLevel, fromLevel, toLevel: level }
}
