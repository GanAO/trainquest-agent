interface Props {
  data: Array<{ date: string; count: number }>
}

function getLast90Days(): string[] {
  const days: string[] = []
  for (let i = 89; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

function getColor(count: number): string {
  if (count === 0) return '#1a1a2e'
  if (count === 1) return '#064e3b'
  if (count === 2) return '#065f46'
  return '#10b981'
}

export default function TrainingHeatmap({ data }: Props) {
  const days = getLast90Days()
  const countMap = new Map(data.map(d => [d.date, d.count]))

  return (
    <div className="card">
      <div className="section-title">训练热力图（近 90 天）</div>
      <div className="flex flex-wrap gap-1">
        {days.map(date => {
          const count = countMap.get(date) ?? 0
          return (
            <div
              key={date}
              title={`${date}: ${count} 次`}
              className="w-3 h-3 rounded-sm cursor-default transition-colors"
              style={{ backgroundColor: getColor(count) }}
            />
          )
        })}
      </div>
      <div className="flex items-center gap-2 mt-3 text-xs text-rpg-muted">
        <span>少</span>
        {[0, 1, 2, 3].map(n => (
          <div
            key={n}
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: getColor(n) }}
          />
        ))}
        <span>多</span>
      </div>
    </div>
  )
}
