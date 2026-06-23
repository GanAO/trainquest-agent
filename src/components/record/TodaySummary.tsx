import type { WorkoutRecord } from '../../domain/types'

const FEELING_EMOJI: Record<string, string> = {
  great: '😄',
  good: '🙂',
  ok: '😐',
  tired: '😴',
  bad: '😣',
}

interface Props {
  workout: WorkoutRecord
  onDelete: (id: string) => void
}

export default function TodaySummary({ workout, onDelete }: Props) {
  const totalVolume = workout.exercises.reduce((sum, ex) => {
    if (ex.type === 'strength') {
      const wkg = ex.unit === 'lb' ? ex.weight * 0.453592 : ex.weight
      return sum + ex.sets * ex.reps * wkg
    }
    return sum
  }, 0)

  const cardioSummary = workout.exercises
    .filter(ex => ex.type === 'cardio')
    .map(ex => `${ex.name} ${ex.duration}分钟`)
    .join('、')

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{FEELING_EMOJI[workout.feeling]}</span>
          <span className="font-semibold">{workout.date}</span>
        </div>
        <button
          onClick={() => onDelete(workout.id)}
          className="text-rpg-muted hover:text-rpg-red text-sm transition-colors"
        >
          删除
        </button>
      </div>
      <div className="flex gap-4 text-sm text-rpg-muted">
        <span>{workout.exercises.length} 个动作</span>
        {totalVolume > 0 && <span>总量 {Math.round(totalVolume)} kg</span>}
        {workout.duration && <span>{workout.duration} 分钟</span>}
      </div>
      {cardioSummary && <div className="text-sm text-rpg-green mt-1">{cardioSummary}</div>}
      <div className="mt-2 flex flex-wrap gap-1">
        {workout.exercises.map(ex => (
          <span
            key={ex.id}
            className="text-xs bg-rpg-border rounded-full px-2 py-0.5"
          >
            {ex.name}
          </span>
        ))}
      </div>
    </div>
  )
}
