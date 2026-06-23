import type { DashboardData } from '../../domain/types'

const GOAL_LABELS: Record<string, string> = {
  lose_weight: '减重目标',
  gain_muscle: '增肌目标',
  maintain: '维持体重',
  improve_cardio: '提升心肺',
}

interface Props {
  data: DashboardData['goalProgress']
  totalWorkouts: number
  totalVolumeTons: number
}

export default function GoalProgress({ data, totalWorkouts, totalVolumeTons }: Props) {
  return (
    <div className="space-y-4">
      {/* 整体统计 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card text-center">
          <div className="text-2xl font-bold text-rpg-accent">{totalWorkouts}</div>
          <div className="text-rpg-muted text-sm">累计训练次数</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-rpg-gold">{totalVolumeTons.toFixed(1)}</div>
          <div className="text-rpg-muted text-sm">累计训练量 (吨)</div>
        </div>
      </div>

      {/* 目标进度 */}
      <div className="card">
        <div className="section-title">目标进度</div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm">{GOAL_LABELS[data.goalType] ?? '未设置目标'}</span>
          <span className="text-rpg-gold font-bold">{data.progressPct}%</span>
        </div>

        {data.targetWeightKg !== null && (
          <>
            <div className="h-3 bg-rpg-border rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-rpg-accent to-rpg-gold rounded-full transition-all duration-700"
                style={{ width: `${data.progressPct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-rpg-muted">
              <span>当前 {data.currentWeightKg} kg</span>
              <span>目标 {data.targetWeightKg} kg</span>
            </div>
          </>
        )}

        {data.targetWeightKg === null && (
          <p className="text-rpg-muted text-sm">在设置中配置目标体重</p>
        )}
      </div>
    </div>
  )
}
