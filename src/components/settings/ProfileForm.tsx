import { useState } from 'react'
import type { ProfileStore, GoalType } from '../../domain/types'
import { profileApi } from '../../api/profile'

interface Props {
  profile: ProfileStore
  onUpdate: (p: ProfileStore) => void
}

const GOAL_OPTIONS: { value: GoalType; label: string }[] = [
  { value: 'lose_weight', label: '减脂' },
  { value: 'gain_muscle', label: '增肌' },
  { value: 'maintain', label: '维持' },
  { value: 'improve_cardio', label: '提升心肺' },
]

const SKIN_OPTIONS: { value: ProfileStore['avatar']['skinTone']; label: string }[] = [
  { value: 'light', label: '浅色' },
  { value: 'medium', label: '中色' },
  { value: 'dark', label: '深色' },
]

const HAIR_STYLE_OPTIONS: { value: ProfileStore['avatar']['hairStyle']; label: string }[] = [
  { value: 'short', label: '短发' },
  { value: 'long', label: '长发' },
  { value: 'bald', label: '光头' },
]

export default function ProfileForm({ profile, onUpdate }: Props) {
  const [height, setHeight] = useState(String(profile.body.heightCm))
  const [weight, setWeight] = useState(String(profile.body.currentWeightKg))
  const [goalType, setGoalType] = useState<GoalType>(profile.goal.type)
  const [targetWeight, setTargetWeight] = useState(String(profile.goal.targetWeightKg ?? ''))
  const [skinTone, setSkinTone] = useState(profile.avatar.skinTone)
  const [hairStyle, setHairStyle] = useState(profile.avatar.hairStyle)
  const [hairColor, setHairColor] = useState(profile.avatar.hairColor)
  const [shirtColor, setShirtColor] = useState(profile.avatar.shirtColor)
  const [shortsColor, setShortsColor] = useState(profile.avatar.shortsColor)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  // 新增体重记录
  const [newWeight, setNewWeight] = useState('')
  const [newWeightDate, setNewWeightDate] = useState(new Date().toISOString().slice(0, 10))

  const handleSave = async () => {
    setSaving(true)
    setMsg('')
    try {
      const updated = await profileApi.update({
        body: {
          heightCm: Number(height),
          currentWeightKg: Number(weight),
          weightLogs: profile.body.weightLogs,
        },
        goal: {
          type: goalType,
          targetWeightKg: targetWeight ? Number(targetWeight) : null,
          targetDate: profile.goal.targetDate,
        },
        avatar: { skinTone, hairStyle, hairColor, shirtColor, shortsColor },
      })
      onUpdate(updated)
      setMsg('保存成功！')
    } catch (e) {
      setMsg('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleAddWeight = async () => {
    if (!newWeight) return
    try {
      await profileApi.addWeightLog(newWeightDate, Number(newWeight))
      const updated = await profileApi.get()
      onUpdate(updated)
      setNewWeight('')
      setMsg('体重已记录！')
    } catch {
      setMsg('记录失败')
    }
  }

  return (
    <div className="space-y-4">
      {/* 身体数据 */}
      <div className="card">
        <div className="section-title">身体数据</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">身高 (cm)</label>
            <input className="input" type="number" value={height} onChange={e => setHeight(e.target.value)} />
          </div>
          <div>
            <label className="label">当前体重 (kg)</label>
            <input className="input" type="number" value={weight} step="0.1" onChange={e => setWeight(e.target.value)} />
          </div>
        </div>
      </div>

      {/* 记录体重 */}
      <div className="card">
        <div className="section-title">记录体重</div>
        <div className="grid grid-cols-2 gap-3 mb-2">
          <div>
            <label className="label">日期</label>
            <input className="input" type="date" value={newWeightDate} onChange={e => setNewWeightDate(e.target.value)} />
          </div>
          <div>
            <label className="label">体重 (kg)</label>
            <input className="input" type="number" step="0.1" placeholder="70.5" value={newWeight} onChange={e => setNewWeight(e.target.value)} />
          </div>
        </div>
        <button className="btn-secondary w-full" onClick={handleAddWeight}>添加体重记录</button>
      </div>

      {/* 目标 */}
      <div className="card">
        <div className="section-title">训练目标</div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {GOAL_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setGoalType(opt.value)}
              className={`py-2 rounded-lg border text-sm transition-colors ${
                goalType === opt.value
                  ? 'border-rpg-accent bg-rpg-accent/20 text-rpg-accent'
                  : 'border-rpg-border text-rpg-muted'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {(goalType === 'lose_weight' || goalType === 'gain_muscle') && (
          <div>
            <label className="label">目标体重 (kg)</label>
            <input className="input" type="number" step="0.1" value={targetWeight} onChange={e => setTargetWeight(e.target.value)} />
          </div>
        )}
      </div>

      {/* 角色外观 */}
      <div className="card">
        <div className="section-title">角色外观</div>
        <div className="space-y-3">
          <div>
            <label className="label">肤色</label>
            <div className="flex gap-2">
              {SKIN_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSkinTone(opt.value)}
                  className={`flex-1 py-1.5 rounded-lg border text-sm transition-colors ${
                    skinTone === opt.value ? 'border-rpg-accent bg-rpg-accent/20' : 'border-rpg-border text-rpg-muted'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">发型</label>
            <div className="flex gap-2">
              {HAIR_STYLE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setHairStyle(opt.value)}
                  className={`flex-1 py-1.5 rounded-lg border text-sm transition-colors ${
                    hairStyle === opt.value ? 'border-rpg-accent bg-rpg-accent/20' : 'border-rpg-border text-rpg-muted'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">发色</label>
              <input type="color" className="w-full h-9 rounded-lg border border-rpg-border bg-rpg-bg cursor-pointer" value={hairColor} onChange={e => setHairColor(e.target.value)} />
            </div>
            <div>
              <label className="label">上衣颜色</label>
              <input type="color" className="w-full h-9 rounded-lg border border-rpg-border bg-rpg-bg cursor-pointer" value={shirtColor} onChange={e => setShirtColor(e.target.value)} />
            </div>
            <div>
              <label className="label">短裤颜色</label>
              <input type="color" className="w-full h-9 rounded-lg border border-rpg-border bg-rpg-bg cursor-pointer" value={shortsColor} onChange={e => setShortsColor(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {msg && <p className={`text-sm ${msg.includes('失败') ? 'text-rpg-red' : 'text-rpg-green'}`}>{msg}</p>}

      <button className="btn-primary w-full" onClick={handleSave} disabled={saving}>
        {saving ? '保存中...' : '保存设置'}
      </button>
    </div>
  )
}
