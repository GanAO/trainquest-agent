import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { ATTRIBUTE_LABELS } from '../../domain/types'
import type { AttributeKey } from '../../domain/types'

interface Props {
  data: Array<{ attribute: AttributeKey; totalXp: number; level: number }>
}

const COLORS: Record<AttributeKey, string> = {
  chest: '#ef4444',
  shoulders: '#f97316',
  back: '#eab308',
  legs: '#84cc16',
  arms: '#22c55e',
  core: '#10b981',
  cardio: '#06b6d4',
}

export default function MuscleDistributionChart({ data }: Props) {
  const chartData = data.map(d => ({
    name: ATTRIBUTE_LABELS[d.attribute],
    attribute: d.attribute,
    xp: d.totalXp,
    level: d.level,
  }))

  return (
    <div className="card">
      <div className="section-title">各肌群训练量（累计 XP）</div>
      {data.every(d => d.totalXp === 0) ? (
        <div className="text-center py-8 text-rpg-muted text-sm">完成训练后数据将显示在这里</div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} width={35} />
            <Tooltip
              contentStyle={{ background: '#1a1a2e', border: '1px solid #2d2d44', borderRadius: 8 }}
              labelStyle={{ color: '#e2e8f0' }}
              formatter={(val: number, _name: string, props: { payload?: { attribute?: AttributeKey } }) => [
                `${val} XP`,
                props.payload?.attribute ? `Lv${data.find(d => d.attribute === props.payload?.attribute)?.level}` : '',
              ]}
            />
            <Bar dataKey="xp" radius={[4, 4, 0, 0]}>
              {chartData.map((entry) => (
                <Cell key={entry.attribute} fill={COLORS[entry.attribute as AttributeKey]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
