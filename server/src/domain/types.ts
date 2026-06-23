// ─── 属性键 ────────────────────────────────────────────────────────────────
export type AttributeKey =
  | 'chest'
  | 'shoulders'
  | 'back'
  | 'legs'
  | 'arms'
  | 'core'
  | 'cardio'

// ─── 训练记录 ────────────────────────────────────────────────────────────────
export type ExerciseType = 'strength' | 'cardio'

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
  duration: number       // 分钟
  distance?: number
  distanceUnit?: 'km' | 'mi'
  note: string
}

export type Exercise = StrengthExercise | CardioExercise

export type FeelingType = 'great' | 'good' | 'ok' | 'tired' | 'bad'

export interface WorkoutRecord {
  id: string
  source: 'manual' | 'chat' | 'feishu'
  date: string           // YYYY-MM-DD
  duration?: number      // 分钟
  feeling: FeelingType
  exercises: Exercise[]
  createdAt: string
  updatedAt: string
}

export interface WorkoutsStore {
  version: number
  items: WorkoutRecord[]
}

// ─── 属性 ────────────────────────────────────────────────────────────────────
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

// ─── 肌肉映射 ─────────────────────────────────────────────────────────────────
export interface MuscleMapEntry {
  exerciseName: string
  aliases: string[]
  type: ExerciseType
  primary: AttributeKey[]
  secondary: AttributeKey[]
  enabled: boolean
  custom: boolean
}

export interface MuscleMapStore {
  version: number
  items: MuscleMapEntry[]
}

// ─── 个人资料 ─────────────────────────────────────────────────────────────────
export type GoalType = 'lose_weight' | 'gain_muscle' | 'maintain' | 'improve_cardio'

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

// ─── 成就 ────────────────────────────────────────────────────────────────────
export type AchievementType = 'habit' | 'breakthrough' | 'goal'

export interface WeeklyWorkoutCountCondition {
  kind: 'weekly_workout_count'
  minCount: number
}
export interface MonthlyWorkoutCountCondition {
  kind: 'monthly_workout_count'
  minCount: number
}
export interface ConsecutiveWeeksCondition {
  kind: 'consecutive_weeks'
  weeks: number
  minPerWeek: number
}
export interface ReturnAfterBreakCondition {
  kind: 'return_after_break'
  minBreakDays: number
}
export interface ExercisePrCondition {
  kind: 'exercise_pr'
  exerciseName?: string  // undefined = any exercise
}
export interface TotalVolumeCondition {
  kind: 'total_volume_kg'
  minVolumeKg: number
}
export interface WeightGoalCondition {
  kind: 'weight_goal'
  goalType: 'lose_weight' | 'gain_muscle'
}

export type AchievementCondition =
  | WeeklyWorkoutCountCondition
  | MonthlyWorkoutCountCondition
  | ConsecutiveWeeksCondition
  | ReturnAfterBreakCondition
  | ExercisePrCondition
  | TotalVolumeCondition
  | WeightGoalCondition

export interface AchievementDefinition {
  id: string
  type: AchievementType
  name: string
  description: string
  icon: string
  condition: AchievementCondition
  enabled: boolean
}

export interface UnlockedAchievement {
  id: string
  unlockedAt: string
}

export interface AchievementsStore {
  version: number
  definitions: AchievementDefinition[]
  unlocked: UnlockedAchievement[]
}

// ─── 仪表盘 ──────────────────────────────────────────────────────────────────
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

// ─── XP 加点结果 ──────────────────────────────────────────────────────────────
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

// ─── 个人体能表 ────────────────────────────────────────────────────────────────
export type Sport = 'basketball' | 'general'
export type AthletePosition = 'guard' | 'forward' | 'center' | 'none'

export type TrainingPriority =
  | 'max_strength'
  | 'hypertrophy_weight_gain'
  | 'basketball_explosiveness'
  | 'recovery'

export type BenchmarkKind =
  | 'body_metric'
  | 'strength'
  | 'bodyweight_reps'
  | 'weighted_reps'

export interface AthleteBasics {
  age: number
  heightCm: number
  bodyWeightKg: number
  sport: Sport
  position: AthletePosition
  notes: string
}

export interface AthletePreferences {
  weeklyFrequency: number
  sessionLimitMinutes: number
  priorities: TrainingPriority[]
  antiAnxietyPrinciple: boolean
}

export interface AthleteBenchmark {
  id: string
  exerciseName: string
  kind: BenchmarkKind
  currentValue: number
  targetMin: number
  targetMax: number
  unit: 'kg' | 'reps'
  targetWeeks: number
  extraWeightKg?: number
  note: string
}

export interface AthleteProfileStore {
  version: number
  updatedAt: string
  basics: AthleteBasics
  preferences: AthletePreferences
  benchmarks: AthleteBenchmark[]
}
