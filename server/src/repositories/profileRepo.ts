import { readJson, writeJson } from './jsonStore'
import { defaultProfileStore } from '../domain/defaults'
import type { ProfileStore, WeightLog } from '../domain/types'

const FILE = 'profile.json'

export function getProfile(): ProfileStore {
  return readJson<ProfileStore>(FILE, defaultProfileStore())
}

export function saveProfile(profile: ProfileStore): void {
  writeJson(FILE, profile)
}

export function addWeightLog(log: WeightLog): void {
  const profile = getProfile()
  const existing = profile.body.weightLogs.findIndex(l => l.date === log.date)
  if (existing >= 0) {
    profile.body.weightLogs[existing] = log
  } else {
    profile.body.weightLogs.push(log)
  }
  profile.body.currentWeightKg = log.weightKg
  profile.body.weightLogs.sort((a, b) => a.date.localeCompare(b.date))
  writeJson(FILE, profile)
}
