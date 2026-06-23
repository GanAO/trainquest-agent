import { useState } from 'react'
import type {
  WorkoutProcessResult,
  ProfileStore,
  AttributesStore,
  AchievementDefinition,
} from '../../domain/types'
import { ATTRIBUTE_LABELS } from '../../domain/types'
import PixelAvatarCanvas from '../character/PixelAvatarCanvas'
import AchievementOverlay from '../achievements/AchievementOverlay'

interface Props {
  result: WorkoutProcessResult
  profile: ProfileStore
  attributes: AttributesStore
  onDone: () => void
}

export default function TrainingSettlement({ result, profile, attributes, onDone }: Props) {
  const [jumping, setJumping] = useState(true)
  const [achievementQueue, setAchievementQueue] = useState<AchievementDefinition[]>(
    result.newAchievements as AchievementDefinition[],
  )

  const copy = '训练已记录，今天这一段完成了。'

  const currentAchievement = achievementQueue[0]

  return (
    <>
      <div className="p-4 flex flex-col items-center">
        {/* 角色跳动 */}
        <div className="mb-4 mt-2">
          <PixelAvatarCanvas attributes={attributes} profile={profile} jumping={jumping} />
        </div>

        {/* 鼓励文案 */}
        <p className="text-center text-rpg-text text-sm px-4 mb-6 leading-relaxed">{copy}</p>

        {/* XP 增益列表 */}
        {result.xpGains.length > 0 && (
          <div className="w-full card mb-4">
            <div className="section-title">属性成长</div>
            <div className="space-y-2">
              {result.xpGains.map(gain => {
                const levelUp = result.levelUps.find(l => l.attribute === gain.attribute)
                return (
                  <div key={gain.attribute} className="flex items-center justify-between">
                    <span className="text-sm text-rpg-text">
                      {ATTRIBUTE_LABELS[gain.attribute]}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-rpg-green text-sm font-semibold">
                        +{gain.xp} XP
                      </span>
                      {levelUp && (
                        <span className="text-rpg-gold text-xs font-pixel level-up-flash">
                          Lv{levelUp.fromLevel}→{levelUp.toLevel}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 成就预告（若有，先给个小提示） */}
        {achievementQueue.length > 0 && (
          <div className="w-full card mb-4 border-rpg-gold/50 bg-rpg-gold/5 text-center">
            <span className="text-rpg-gold text-sm">
              🏆 解锁了 {achievementQueue.length} 个成就，点击查看
            </span>
          </div>
        )}

        <button
          className="btn-primary w-full py-3 text-base"
          onClick={() => {
            if (achievementQueue.length > 0) {
              setJumping(false)
            } else {
              onDone()
            }
          }}
        >
          {achievementQueue.length > 0 ? '🏆 查看成就' : '完成'}
        </button>
      </div>

      {/* 成就全屏庆祝（逐个） */}
      {!jumping && currentAchievement && (
        <AchievementOverlay
          achievement={currentAchievement}
          onClose={() => {
            const next = achievementQueue.slice(1)
            setAchievementQueue(next)
            if (next.length === 0) onDone()
          }}
        />
      )}
    </>
  )
}
