import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ProfileForm from '../components/settings/ProfileForm'
import MuscleMapEditor from '../components/settings/MuscleMapEditor'
import AchievementList from '../components/settings/AchievementList'
import DataExportButton from '../components/settings/DataExportButton'
import type { ProfileStore } from '../domain/types'
import { profileApi } from '../api/profile'

export default function SettingsPage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<ProfileStore | null>(null)
  const [loading, setLoading] = useState(true)
  const [section, setSection] = useState<'profile' | 'muscle' | 'achievements' | 'data'>('profile')

  useEffect(() => {
    profileApi.get().then(p => {
      setProfile(p)
      setLoading(false)
    })
  }, [])

  if (loading || !profile) {
    return <div className="flex items-center justify-center h-64 text-rpg-muted">加载中...</div>
  }

  const sections = [
    { id: 'profile' as const, label: '个人资料', icon: '👤' },
    { id: 'muscle' as const, label: '肌肉映射', icon: '💪' },
    { id: 'achievements' as const, label: '成就', icon: '🏆' },
    { id: 'data' as const, label: '数据', icon: '📦' },
  ]

  return (
    <div className="p-4 pt-14">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate('/')} className="text-rpg-muted hover:text-rpg-text transition-colors text-sm">← 返回</button>
        <h1 className="font-pixel text-rpg-gold text-xs">设置</h1>
      </div>

      {/* 导航标签 */}
      <div className="grid grid-cols-4 gap-1 mb-4">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`flex flex-col items-center py-2 rounded-lg text-xs transition-colors ${
              section === s.id
                ? 'bg-rpg-accent/20 text-rpg-accent border border-rpg-accent/50'
                : 'text-rpg-muted hover:text-rpg-text'
            }`}
          >
            <span className="text-lg">{s.icon}</span>
            <span className="mt-0.5">{s.label}</span>
          </button>
        ))}
      </div>

      {section === 'profile' && (
        <ProfileForm profile={profile} onUpdate={setProfile} />
      )}
      {section === 'muscle' && <MuscleMapEditor />}
      {section === 'achievements' && <AchievementList />}
      {section === 'data' && <DataExportButton />}
    </div>
  )
}
