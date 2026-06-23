import { useEffect, useState } from 'react'
import { useAchievementStore } from './achievementStore'

export default function AchievementToast() {
  const { queue, dismiss } = useAchievementStore()
  const [visible, setVisible] = useState(false)
  const current = queue[0]

  useEffect(() => {
    if (current) {
      setVisible(true)
      const t = setTimeout(() => {
        setVisible(false)
        setTimeout(() => dismiss(current.id), 300)
      }, 3500)
      return () => clearTimeout(t)
    }
  }, [current, dismiss])

  if (!current) return null

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-xs w-full px-4 ${
        visible ? 'achievement-enter' : 'achievement-exit'
      }`}
    >
      <div className="card border-rpg-gold bg-rpg-panel shadow-xl flex items-center gap-3">
        <span className="text-3xl">{current.icon}</span>
        <div>
          <div className="text-rpg-gold font-bold text-sm">成就解锁！</div>
          <div className="font-semibold">{current.name}</div>
          <div className="text-rpg-muted text-xs">{current.description}</div>
        </div>
      </div>
    </div>
  )
}
