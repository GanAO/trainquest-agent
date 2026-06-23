import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PixelAvatarCanvas from '../components/character/PixelAvatarCanvas'
import AttributePanel from '../components/character/AttributePanel'
import type { AttributesStore, ProfileStore } from '../domain/types'
import { attributesApi } from '../api/dashboard'
import { profileApi } from '../api/profile'

export default function CharacterPage() {
  const navigate = useNavigate()
  const [attributes, setAttributes] = useState<AttributesStore | null>(null)
  const [profile, setProfile] = useState<ProfileStore | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([attributesApi.get(), profileApi.get()]).then(([attrs, prof]) => {
      setAttributes(attrs)
      setProfile(prof)
      setLoading(false)
    })
  }, [])

  if (loading || !attributes || !profile) {
    return (
      <div className="flex items-center justify-center h-64 text-rpg-muted">
        加载中...
      </div>
    )
  }

  const totalLevel = Object.values(attributes.items).reduce((sum, s) => sum + s.level, 0)

  return (
    <div className="p-4 pt-14">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate('/')} className="text-rpg-muted hover:text-rpg-text transition-colors text-sm">← 返回</button>
        <h1 className="font-pixel text-rpg-gold text-xs">角色详情</h1>
      </div>

      {/* 总等级 */}
      <div className="text-center mb-2">
        <span className="text-rpg-muted text-sm">综合等级</span>
        <div className="font-pixel text-rpg-gold text-2xl mt-1">Lv {totalLevel}</div>
      </div>

      {/* 像素角色 */}
      <div className="card mb-4 py-6">
        <PixelAvatarCanvas attributes={attributes} profile={profile} />
      </div>

      {/* 属性面板 */}
      <AttributePanel attributes={attributes} />
    </div>
  )
}
