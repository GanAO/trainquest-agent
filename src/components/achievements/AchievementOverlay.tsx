import type { AchievementDefinition } from '../../domain/types'

interface Props {
  achievement: AchievementDefinition
  onClose: () => void
}

export default function AchievementOverlay({ achievement, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="card border-rpg-gold max-w-xs w-full mx-4 text-center achievement-enter"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-6xl mb-4">{achievement.icon}</div>
        <div className="font-pixel text-rpg-gold text-xs mb-2">成就解锁！</div>
        <div className="text-xl font-bold mb-2">{achievement.name}</div>
        <div className="text-rpg-muted text-sm mb-6">{achievement.description}</div>
        <button className="btn-primary w-full" onClick={onClose}>
          太棒了！
        </button>
      </div>
    </div>
  )
}
