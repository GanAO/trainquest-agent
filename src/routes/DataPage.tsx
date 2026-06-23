import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import WeightTrendChart from '../components/dashboard/WeightTrendChart'
import TrainingHeatmap from '../components/dashboard/TrainingHeatmap'
import MuscleDistributionChart from '../components/dashboard/MuscleDistributionChart'
import GoalProgress from '../components/dashboard/GoalProgress'
import type { DashboardData } from '../domain/types'
import { dashboardApi } from '../api/dashboard'

export default function DataPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dashboardApi.get().then(d => {
      setData(d)
      setLoading(false)
    })
  }, [])

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-rpg-muted">
        加载中...
      </div>
    )
  }

  return (
    <div className="p-4 pt-14 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/')} className="text-rpg-muted hover:text-rpg-text transition-colors text-sm">← 返回</button>
        <h1 className="font-pixel text-rpg-gold text-xs">数据统计</h1>
      </div>

      <GoalProgress
        data={data.goalProgress}
        totalWorkouts={data.totalWorkouts}
        totalVolumeTons={data.totalVolumeTons}
      />

      <WeightTrendChart data={data.weightTrend} />

      <MuscleDistributionChart data={data.muscleDistribution} />

      <TrainingHeatmap data={data.workoutFrequency} />
    </div>
  )
}
