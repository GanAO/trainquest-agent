import { readJson, writeJson } from './jsonStore'
import { defaultAthleteProfile } from '../domain/defaults'
import type { AthleteProfileStore } from '../domain/types'

const FILE = 'athlete-profile.json'

export function getAthleteProfile(): AthleteProfileStore {
  return readJson<AthleteProfileStore>(FILE, defaultAthleteProfile())
}

export function saveAthleteProfile(profile: AthleteProfileStore): void {
  writeJson(FILE, profile)
}
