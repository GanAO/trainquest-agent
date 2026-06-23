export type AttributeKey =
  | 'chest'
  | 'shoulders'
  | 'back'
  | 'legs'
  | 'arms'
  | 'core'
  | 'cardio'

export const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  chest: '胸',
  shoulders: '肩',
  back: '背',
  legs: '腿',
  arms: '手臂',
  core: '核心',
  cardio: '心肺',
}

export const ALL_ATTRIBUTES: AttributeKey[] = [
  'chest', 'shoulders', 'back', 'legs', 'arms', 'core', 'cardio',
]

export type ExerciseType = 'strength' | 'cardio'
export type FeelingType = 'great' | 'good' | 'ok' | 'tired' | 'bad'
export type GoalType = 'lose_weight' | 'gain_muscle' | 'maintain' | 'improve_cardio'

export interface StrengthExercise {
  id: string
  name: string
  type: 'strength'
  sets: number
  reps: number
  weight: number
  unit: 'kg' | 'lb'
  note: string
}

export interface CardioExercise {
  id: string
  name: string
  type: 'cardio'
  duration: number
  distance?: number
  distanceUnit?: 'km' | 'mi'
  note: string
}

export type Exercise = StrengthExercise | CardioExercise

export interface WorkoutRecord {
  id: string
  source: 'manual' | 'chat' | 'feishu'
  date: string
  duration?: number
  feeling: FeelingType
  exercises: Exercise[]
  createdAt: string
  updatedAt: string
}

export interface AttributeState {
  level: number
  xp: number
  totalXp: number
  lastChangedAt: string | null
}

export interface AttributesStore {
  version: number
  items: Record<AttributeKey, AttributeState>
  lastWorkoutIdApplied: string | null
}

export interface MuscleMapEntry {
  exerciseName: string
  aliases: string[]
  type: ExerciseType
  primary: AttributeKey[]
  secondary: AttributeKey[]
  enabled: boolean
  custom: boolean
}

export interface WeightLog {
  date: string
  weightKg: number
}

export interface ProfileStore {
  version: number
  body: {
    heightCm: number
    currentWeightKg: number
    weightLogs: WeightLog[]
  }
  goal: {
    type: GoalType
    targetWeightKg: number | null
    targetDate: string | null
  }
  avatar: {
    skinTone: 'light' | 'medium' | 'dark'
    hairStyle: 'short' | 'long' | 'bald'
    hairColor: string
    shirtColor: string
    shortsColor: string
  }
}

export interface AchievementDefinition {
  id: string
  type: 'habit' | 'breakthrough' | 'goal'
  name: string
  description: string
  icon: string
  enabled: boolean
  unlocked: boolean
  unlockedAt: string | null
}

export interface XpGain {
  attribute: AttributeKey
  xp: number
}

export interface LevelUpEvent {
  attribute: AttributeKey
  fromLevel: number
  toLevel: number
}

export interface WorkoutProcessResult {
  workout: WorkoutRecord
  xpGains: XpGain[]
  levelUps: LevelUpEvent[]
  newAchievements: AchievementDefinition[]
}

export interface DashboardData {
  weightTrend: WeightLog[]
  workoutFrequency: Array<{ date: string; count: number }>
  muscleDistribution: Array<{ attribute: AttributeKey; totalXp: number; level: number }>
  goalProgress: {
    goalType: GoalType
    currentWeightKg: number
    targetWeightKg: number | null
    progressPct: number
  }
  recentWorkouts: WorkoutRecord[]
  totalWorkouts: number
  totalVolumeTons: number
}
