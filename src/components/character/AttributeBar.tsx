import { ATTRIBUTE_LABELS } from '../../domain/types'
import type { AttributeKey, AttributeState } from '../../domain/types'
import { xpToNextLevel } from '../../domain/formulas'

interface Props {
  attrKey: AttributeKey
  state: AttributeState
}

const ATTR_COLORS: Record<AttributeKey, string> = {
  chest: 'bg-red-500',
  shoulders: 'bg-orange-500',
  back: 'bg-amber-500',
  legs: 'bg-yellow-500',
  arms: 'bg-lime-500',
  core: 'bg-emerald-500',
  cardio: 'bg-cyan-500',
}

export default function AttributeBar({ attrKey, state }: Props) {
  const needed = xpToNextLevel(state.level)
  const pct = Math.min(100, Math.round((state.xp / needed) * 100))

  return (
    <div className="flex items-center gap-3">
      <div className="w-12 text-center">
        <div className="text-xs text-rpg-muted">{ATTRIBUTE_LABELS[attrKey]}</div>
        <div className="text-rpg-gold font-bold text-sm">Lv{state.level}</div>
      </div>
      <div className="flex-1">
        <div className="flex justify-between text-xs text-rpg-muted mb-1">
          <span>{state.xp} / {needed} XP</span>
          <span>{pct}%</span>
        </div>
        <div className="h-3 bg-rpg-border rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${ATTR_COLORS[attrKey]}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
