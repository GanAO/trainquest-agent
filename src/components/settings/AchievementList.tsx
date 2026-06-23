import { useEffect, useState } from 'react'
import type { AchievementDefinition } from '../../domain/types'
import { achievementsApi } from '../../api/achievements'

const TYPE_LABELS: Record<string, string> = {
  habit: '习惯',
  breakthrough: '突破',
  goal: '目标',
}

export default function AchievementList() {
  const [items, setItems] = useState<AchievementDefinition[]>([])
  const [counts, setCounts] = useState({ unlocked: 0, total: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    achievementsApi.list().then(data => {
      setItems(data.items)
      setCounts({ unlocked: data.unlockedCount, total: data.totalCount })
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="card text-rpg-muted text-sm">加载中...</div>

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="section-title mb-0">成就</div>
        <span className="text-rpg-gold text-sm font-bold">{counts.unlocked} / {counts.total}</span>
      </div>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {items.map(item => (
          <div
            key={item.id}
            className={`flex items-center gap-3 p-2 rounded-lg border transition-colors ${
              item.unlocked ? 'border-rpg-gold/50 bg-rpg-gold/5' : 'border-rpg-border opacity-60'
            }`}
          >
            <span className={`text-2xl ${item.unlocked ? '' : 'grayscale'}`}>{item.icon}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{item.name}</span>
                <span className="text-xs text-rpg-muted">{TYPE_LABELS[item.type]}</span>
              </div>
              <div className="text-xs text-rpg-muted">{item.description}</div>
              {item.unlockedAt && (
                <div className="text-xs text-rpg-gold mt-0.5">
                  {new Date(item.unlockedAt).toLocaleDateString('zh-CN')} 解锁
                </div>
              )}
            </div>
            {item.unlocked && <span className="text-rpg-gold">✓</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
