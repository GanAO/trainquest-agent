import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import WorkoutHistory from '../components/record/WorkoutHistory'
import type { WorkoutRecord } from '../domain/types'
import { workoutsApi } from '../api/workouts'

export default function HistoryPage() {
  const navigate = useNavigate()
  const [workouts, setWorkouts] = useState<WorkoutRecord[]>([])
  const [loading, setLoading] = useState(true)

  const fetchWorkouts = useCallback(async () => {
    setLoading(true)
    try {
      const data = await workoutsApi.list()
      setWorkouts(data.items)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWorkouts()
  }, [fetchWorkouts])

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除这条训练记录吗？')) return
    await workoutsApi.delete(id)
    fetchWorkouts()
  }

  return (
    <div className="p-4 pt-14">
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => navigate('/')}
          className="text-rpg-muted hover:text-rpg-text transition-colors text-sm"
        >
          ← 返回
        </button>
        <h1 className="font-pixel text-rpg-gold text-xs">训练记录</h1>
        {!loading && (
          <span className="text-rpg-muted text-xs ml-auto">共 {workouts.length} 次</span>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-rpg-muted">加载中...</div>
      ) : (
        <WorkoutHistory workouts={workouts} onDelete={handleDelete} />
      )}
    </div>
  )
}
