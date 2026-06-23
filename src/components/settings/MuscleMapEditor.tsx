import { useState, useEffect } from 'react'
import type { MuscleMapEntry } from '../../domain/types'
import { ATTRIBUTE_LABELS } from '../../domain/types'
import { api } from '../../api/client'

export default function MuscleMapEditor() {
  const [entries, setEntries] = useState<MuscleMapEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<{ items: MuscleMapEntry[] }>('/muscle-map').then(d => {
      setEntries(d.items)
      setLoading(false)
    })
  }, [])

  const toggleEnabled = async (entry: MuscleMapEntry) => {
    const updated = { ...entry, enabled: !entry.enabled }
    await api.put(`/muscle-map/${encodeURIComponent(entry.exerciseName)}`, updated)
    setEntries(prev => prev.map(e => e.exerciseName === entry.exerciseName ? updated : e))
  }

  if (loading) return <div className="card text-rpg-muted text-sm">加载中...</div>

  return (
    <div className="card">
      <div className="section-title">动作映射表</div>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {entries.map(entry => (
          <div
            key={entry.exerciseName}
            className={`flex items-center justify-between p-2 rounded-lg border transition-colors ${
              entry.enabled ? 'border-rpg-border' : 'border-rpg-border/30 opacity-50'
            }`}
          >
            <div>
              <div className="font-medium text-sm">{entry.exerciseName}</div>
              <div className="text-xs text-rpg-muted">
                主：{entry.primary.map(k => ATTRIBUTE_LABELS[k]).join('、') || '—'}
                {entry.secondary.length > 0 && `  次：${entry.secondary.map(k => ATTRIBUTE_LABELS[k]).join('、')}`}
              </div>
            </div>
            <button
              onClick={() => toggleEnabled(entry)}
              className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                entry.enabled
                  ? 'border-rpg-green text-rpg-green'
                  : 'border-rpg-muted text-rpg-muted'
              }`}
            >
              {entry.enabled ? '启用' : '禁用'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
