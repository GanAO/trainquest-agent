import { useState, useEffect } from 'react'
import { api } from '../../api/client'
import type { MuscleMapEntry } from '../../domain/types'

interface Props {
  value: string
  onChange: (name: string) => void
  onClose: () => void
}

export default function ExercisePicker({ value, onChange, onClose }: Props) {
  const [search, setSearch] = useState('')
  const [exercises, setExercises] = useState<MuscleMapEntry[]>([])

  useEffect(() => {
    api.get<{ items: MuscleMapEntry[] }>('/muscle-map').then(data => {
      setExercises(data.items.filter(e => e.enabled))
    })
  }, [])

  const filtered = exercises.filter(e =>
    e.exerciseName.toLowerCase().includes(search.toLowerCase()) ||
    e.aliases.some(a => a.toLowerCase().includes(search.toLowerCase())),
  )

  const handleSelect = (name: string) => {
    onChange(name)
    onClose()
  }

  const handleCustom = () => {
    if (search.trim()) {
      onChange(search.trim())
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-40 flex items-end">
      <div className="w-full max-w-md mx-auto bg-rpg-panel rounded-t-2xl border-t border-rpg-border p-4 max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-rpg-text">选择动作</h3>
          <button onClick={onClose} className="text-rpg-muted hover:text-rpg-text text-2xl leading-none">×</button>
        </div>

        <input
          className="input mb-3"
          placeholder="搜索动作名..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />

        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 && search.trim() && (
            <button
              className="w-full text-left p-3 rounded-lg hover:bg-rpg-border transition-colors text-rpg-accent"
              onClick={handleCustom}
            >
              + 使用自定义动作：{search}
            </button>
          )}
          {filtered.map(entry => (
            <button
              key={entry.exerciseName}
              className={`w-full text-left p-3 rounded-lg hover:bg-rpg-border transition-colors flex items-center justify-between ${
                entry.exerciseName === value ? 'bg-rpg-border' : ''
              }`}
              onClick={() => handleSelect(entry.exerciseName)}
            >
              <span>{entry.exerciseName}</span>
              <span className="text-rpg-muted text-xs">
                {entry.type === 'cardio' ? '有氧' : '力量'}
                {' · '}
                {entry.primary.length > 0 && entry.primary.join('/')}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
