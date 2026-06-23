import { useState } from 'react'
import type { WorkoutRecord } from '../../domain/types'
import TodaySummary from './TodaySummary'

interface Props {
  workouts: WorkoutRecord[]
  onDelete: (id: string) => void
}

const PAGE_SIZE = 10

export default function WorkoutHistory({ workouts, onDelete }: Props) {
  const [page, setPage] = useState(1)

  if (workouts.length === 0) {
    return (
      <div className="text-center py-12 text-rpg-muted">
        <div className="text-4xl mb-3">🏋️</div>
        <p>还没有训练记录</p>
        <p className="text-sm mt-1">完成第一次训练吧！</p>
      </div>
    )
  }

  const paged = workouts.slice(0, page * PAGE_SIZE)
  const hasMore = workouts.length > paged.length

  return (
    <div>
      {paged.map(w => (
        <TodaySummary key={w.id} workout={w} onDelete={onDelete} />
      ))}
      {hasMore && (
        <button
          className="btn-secondary w-full mt-2"
          onClick={() => setPage(p => p + 1)}
        >
          加载更多
        </button>
      )}
    </div>
  )
}
