import { useState } from 'react'
import ExercisePicker from './ExercisePicker'
import type { StrengthExercise, CardioExercise } from '../../domain/types'

type DraftStrength = Omit<StrengthExercise, 'id'>
type DraftCardio = Omit<CardioExercise, 'id'>
export type DraftExercise = DraftStrength | DraftCardio

interface Props {
  exercise: DraftExercise
  index: number
  onChange: (index: number, ex: DraftExercise) => void
  onRemove: (index: number) => void
  compact?: boolean
}

export default function ExerciseRow({ exercise, index, onChange, onRemove, compact = false }: Props) {
  const [showPicker, setShowPicker] = useState(false)

  const handleNameChange = (name: string) => {
    onChange(index, { ...exercise, name })
  }

  const toggleType = () => {
    if (exercise.type === 'strength') {
      const next: DraftCardio = { name: exercise.name, type: 'cardio', duration: 30, note: '' }
      onChange(index, next)
    } else {
      const next: DraftStrength = { name: exercise.name, type: 'strength', sets: 3, reps: 10, weight: 0, unit: 'kg', note: '' }
      onChange(index, next)
    }
  }

  const outerClass = compact
    ? 'bg-rpg-panel border border-rpg-border rounded-xl p-2 mb-2'
    : 'card mb-3'

  const headerRowClass = compact
    ? 'flex items-center gap-2 mb-2'
    : 'flex items-center gap-2 mb-3'

  // compact 模式直接拼基础样式避免与 .input py-2 冲突
  const inputClass = compact
    ? 'bg-rpg-bg border border-rpg-border rounded-lg px-2 py-1 text-rpg-text text-sm text-center focus:outline-none focus:border-rpg-accent transition-colors w-full'
    : 'input text-center'

  const labelClass = compact
    ? 'text-rpg-muted text-xs mb-0.5 block text-center'
    : 'label text-center'

  const gridGap = compact ? 'gap-1.5' : 'gap-2'

  return (
    <div className={outerClass}>
      <div className={headerRowClass}>
        {/* 动作名 + note chip（同一行） */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <button
            className="text-left font-semibold truncate hover:text-rpg-accent transition-colors"
            onClick={() => setShowPicker(true)}
          >
            {exercise.name || <span className="text-rpg-muted">点击选择动作</span>}
          </button>
          {exercise.note && (
            <span className="text-[10px] text-rpg-muted bg-rpg-bg border border-rpg-border
              px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap leading-tight">
              {exercise.note}
            </span>
          )}
        </div>

        <button
          onClick={toggleType}
          className={`text-xs px-2 py-1 rounded-full border transition-colors shrink-0 ${
            exercise.type === 'cardio'
              ? 'border-rpg-green text-rpg-green'
              : 'border-rpg-accent text-rpg-accent'
          }`}
        >
          {exercise.type === 'cardio' ? '有氧' : '力量'}
        </button>
        <button
          onClick={() => onRemove(index)}
          className="text-rpg-muted hover:text-rpg-red transition-colors text-lg leading-none shrink-0"
        >
          ×
        </button>
      </div>

      {exercise.type === 'strength' ? (
        <div className={`grid grid-cols-3 ${gridGap}`}>
          <div>
            <label className={labelClass}>组数</label>
            <input
              type="number"
              className={inputClass}
              min={1}
              value={exercise.sets}
              onChange={e =>
                onChange(index, { ...exercise, sets: Number(e.target.value) } as DraftStrength)
              }
            />
          </div>
          <div>
            <label className={labelClass}>次数</label>
            <input
              type="number"
              className={inputClass}
              min={1}
              value={exercise.reps}
              onChange={e =>
                onChange(index, { ...exercise, reps: Number(e.target.value) } as DraftStrength)
              }
            />
          </div>
          <div>
            <label className={labelClass}>重量 (kg)</label>
            <input
              type="number"
              className={inputClass}
              min={0}
              step={0.5}
              value={exercise.weight}
              onChange={e =>
                onChange(index, { ...exercise, weight: Number(e.target.value) } as DraftStrength)
              }
            />
          </div>
        </div>
      ) : (
        <div className={`grid grid-cols-2 ${gridGap}`}>
          <div>
            <label className={labelClass}>时长 (分钟)</label>
            <input
              type="number"
              className={inputClass}
              min={1}
              value={exercise.duration}
              onChange={e =>
                onChange(index, { ...exercise, duration: Number(e.target.value) } as DraftCardio)
              }
            />
          </div>
          <div>
            <label className={labelClass}>距离 (km, 可选)</label>
            <input
              type="number"
              className={inputClass}
              min={0}
              step={0.1}
              value={exercise.distance ?? ''}
              onChange={e =>
                onChange(index, {
                  ...exercise,
                  distance: e.target.value ? Number(e.target.value) : undefined,
                } as DraftCardio)
              }
            />
          </div>
        </div>
      )}

      {showPicker && (
        <ExercisePicker
          value={exercise.name}
          onChange={handleNameChange}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}
