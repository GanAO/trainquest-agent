import { useState } from 'react'
import type { FeelingType, WorkoutProcessResult } from '../../domain/types'
import type { TrainingDraft } from '../../api/intake'
import ExerciseRow, { type DraftExercise } from './ExerciseRow'
import { workoutsApi, type CreateWorkoutPayload } from '../../api/workouts'

interface Props {
  onSuccess: (result: WorkoutProcessResult) => void
  onCancel: () => void
  quickNote?: string
  initialDraft?: TrainingDraft
}

const FEELING_OPTIONS: { value: FeelingType; label: string; emoji: string }[] = [
  { value: 'great', label: '超好', emoji: '😄' },
  { value: 'good', label: '不错', emoji: '🙂' },
  { value: 'ok', label: '一般', emoji: '😐' },
  { value: 'tired', label: '累', emoji: '😴' },
  { value: 'bad', label: '难受', emoji: '😣' },
]

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function makeDefaultExercise(): DraftExercise {
  return { name: '', type: 'strength', sets: 3, reps: 10, weight: 0, unit: 'kg', note: '' }
}

export default function WorkoutForm({ onSuccess, onCancel, quickNote, initialDraft }: Props) {
  const [date, setDate] = useState(() => initialDraft?.date ?? today())
  const [feeling, setFeeling] = useState<FeelingType>(() => initialDraft?.feeling ?? 'good')
  const [duration, setDuration] = useState<string>('')
  const [exercises, setExercises] = useState<DraftExercise[]>(() =>
    initialDraft?.exercises?.length
      ? (initialDraft.exercises as DraftExercise[])
      : [makeDefaultExercise()]
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const addExercise = () => {
    setExercises(prev => [...prev, makeDefaultExercise()])
  }

  const updateExercise = (index: number, ex: DraftExercise) => {
    setExercises(prev => prev.map((e, i) => (i === index ? ex : e)))
  }

  const removeExercise = (index: number) => {
    setExercises(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    setError('')
    const filled = exercises.filter(e => e.name.trim())
    if (filled.length === 0) {
      setError('至少添加一个动作')
      return
    }

    setLoading(true)
    try {
      const payload: CreateWorkoutPayload = {
        date,
        exercises: filled,
        feeling,
        ...(duration ? { duration: Number(duration) } : {}),
      }
      const result = await workoutsApi.create(payload)

      setExercises([makeDefaultExercise()])
      setDuration('')
      setDate(today())
      onSuccess(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-rpg-text">详细编辑</h2>
        <button onClick={onCancel} className="text-rpg-muted hover:text-rpg-text text-sm transition-colors">
          ← 返回
        </button>
      </div>

      {/* 来自一句话记录的备注 */}
      {quickNote && (
        <div className="mb-4 px-3 py-2 bg-rpg-panel border border-rpg-border rounded-lg">
          <p className="text-rpg-muted text-xs mb-0.5">你说的</p>
          <p className="text-rpg-text text-sm leading-relaxed">{quickNote}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="label">日期</label>
          <input
            type="date"
            className="input"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label">时长 (分钟)</label>
          <input
            type="number"
            className="input"
            placeholder="可选"
            min={1}
            value={duration}
            onChange={e => setDuration(e.target.value)}
          />
        </div>
      </div>

      <div className="mb-4">
        <label className="label">训练感受</label>
        <div className="flex gap-2">
          {FEELING_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFeeling(opt.value)}
              className={`flex-1 flex flex-col items-center py-2 rounded-lg border transition-colors ${
                feeling === opt.value
                  ? 'border-rpg-accent bg-rpg-accent/20 text-rpg-accent'
                  : 'border-rpg-border text-rpg-muted hover:border-rpg-text'
              }`}
            >
              <span className="text-xl">{opt.emoji}</span>
              <span className="text-xs mt-0.5">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <div className="section-title">动作</div>
        {exercises.map((ex, i) => (
          <ExerciseRow
            key={i}
            exercise={ex}
            index={i}
            onChange={updateExercise}
            onRemove={removeExercise}
          />
        ))}
        <button
          onClick={addExercise}
          className="btn-secondary w-full flex items-center justify-center gap-2"
        >
          <span className="text-xl leading-none">+</span>
          添加动作
        </button>
      </div>

      {error && <p className="text-rpg-red text-sm mb-3">{error}</p>}

      <button
        className="btn-primary w-full text-lg py-3"
        onClick={handleSubmit}
        disabled={loading}
      >
        {loading ? '记录中...' : '💪 完成训练'}
      </button>
    </div>
  )
}
