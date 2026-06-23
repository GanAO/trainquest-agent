import { readJson, writeJson } from './jsonStore'
import { defaultWorkoutsStore } from '../domain/defaults'
import type { WorkoutRecord, WorkoutsStore } from '../domain/types'

const FILE = 'workouts.json'

export function getStore(): WorkoutsStore {
  return readJson<WorkoutsStore>(FILE, defaultWorkoutsStore())
}

export function getAllWorkouts(): WorkoutRecord[] {
  return getStore().items.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )
}

export function getWorkoutById(id: string): WorkoutRecord | undefined {
  return getStore().items.find(w => w.id === id)
}

export function saveWorkout(workout: WorkoutRecord): void {
  const store = getStore()
  const idx = store.items.findIndex(w => w.id === workout.id)
  if (idx >= 0) {
    store.items[idx] = workout
  } else {
    store.items.push(workout)
  }
  writeJson(FILE, store)
}

export function deleteWorkout(id: string): boolean {
  const store = getStore()
  const before = store.items.length
  store.items = store.items.filter(w => w.id !== id)
  if (store.items.length < before) {
    writeJson(FILE, store)
    return true
  }
  return false
}
