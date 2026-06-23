import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { WeightLog } from '../../domain/types'

interface Props {
  data: WeightLog[]
}

export default function WeightTrendChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="card">
        <div className="section-title">体重趋势</div>
        <div className="text-center py-8 text-rpg-muted text-sm">
          暂无体重记录，在设置中添加
        </div>
      </div>
    )
  }

  const chartData = data.map(d => ({
    date: d.date.slice(5),
    weight: d.weightKg,
  }))

  return (
    <div className="card">
      <div className="section-title">体重趋势 (kg)</div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2d2d44" />
          <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} />
          <YAxis
            domain={['auto', 'auto']}
            tick={{ fill: '#64748b', fontSize: 10 }}
            width={35}
          />
          <Tooltip
            contentStyle={{ background: '#1a1a2e', border: '1px solid #2d2d44', borderRadius: 8 }}
            labelStyle={{ color: '#e2e8f0' }}
            itemStyle={{ color: '#3b82f6' }}
          />
          <Line
            type="monotone"
            dataKey="weight"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
