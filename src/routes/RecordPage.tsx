import { useState, useEffect, useCallback } from 'react'
import RpgHomeScreen from './RpgHomeScreen'
import QuickLogScreen from '../components/record/QuickLogScreen'
import WorkoutForm from '../components/record/WorkoutForm'
import TrainingSettlement from '../components/record/TrainingSettlement'
import type { WorkoutRecord, AttributesStore, ProfileStore, WorkoutProcessResult } from '../domain/types'
import type { TrainingDraft } from '../api/intake'
import { workoutsApi } from '../api/workouts'
import { attributesApi } from '../api/dashboard'
import { profileApi } from '../api/profile'

type Screen = 'home' | 'quick' | 'form' | 'settlement'

export default function RecordPage() {
  const [screen, setScreen] = useState<Screen>('home')
  const [quickNote, setQuickNote] = useState('')
  const [quickDraft, setQuickDraft] = useState<TrainingDraft | null>(null)
  const [workouts, setWorkouts] = useState<WorkoutRecord[]>([])
  const [attributes, setAttributes] = useState<AttributesStore | null>(null)
  const [profile, setProfile] = useState<ProfileStore | null>(null)
  const [settlementResult, setSettlementResult] = useState<WorkoutProcessResult | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [wData, attrs, prof] = await Promise.all([
        workoutsApi.list(),
        attributesApi.get(),
        profileApi.get(),
      ])
      setWorkouts(wData.items)
      setAttributes(attrs)
      setProfile(prof)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const handleWorkoutSuccess = (result: WorkoutProcessResult) => {
    setSettlementResult(result)
    setScreen('settlement')
    fetchAll()
  }

  const handleSettlementDone = () => {
    setSettlementResult(null)
    setQuickNote('')
    setQuickDraft(null)
    setScreen('home')
  }

  const handleQuickToForm = (note: string, draft?: TrainingDraft) => {
    setQuickNote(note)
    setQuickDraft(draft ?? null)
    setScreen('form')
  }

  if (loading && !attributes) {
    return (
      <div className="flex items-center justify-center h-64 text-rpg-muted">
        加载中...
      </div>
    )
  }

  if (screen === 'quick') {
    return (
      <QuickLogScreen
        onWorkoutSuccess={handleWorkoutSuccess}
        onExpand={handleQuickToForm}
        onCancel={() => setScreen('home')}
      />
    )
  }

  if (screen === 'form') {
    return (
      <div className="p-4 pt-14">
        <WorkoutForm
          onSuccess={handleWorkoutSuccess}
          onCancel={() => setScreen('quick')}
          quickNote={quickNote}
          initialDraft={quickDraft ?? undefined}
        />
      </div>
    )
  }

  if (screen === 'settlement' && settlementResult && attributes && profile) {
    return (
      <TrainingSettlement
        result={settlementResult}
        profile={profile}
        attributes={attributes}
        onDone={handleSettlementDone}
      />
    )
  }

  return (
    <RpgHomeScreen
      attributes={attributes}
      profile={profile}
      workouts={workouts}
      onStartWorkout={() => setScreen('quick')}
    />
  )
}
