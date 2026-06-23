import { useState } from 'react'
import type { AttributesStore, ProfileStore, WorkoutRecord } from '../domain/types'
import { ALL_ATTRIBUTES } from '../domain/types'
import PixelAvatarCanvas from '../components/character/PixelAvatarCanvas'
import AttributeBar from '../components/character/AttributeBar'

interface Props {
  attributes: AttributesStore | null
  profile: ProfileStore | null
  workouts: WorkoutRecord[]
  onStartWorkout: () => void
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 6) return '夜深了，你还在'
  if (h < 12) return '早上好'
  if (h < 18) return '下午好'
  return '晚上好'
}

// 用本地 YYYY-MM-DD 字符串比较，避免时区导致负数
function localDateStr(): string {
  return new Date().toLocaleDateString('sv') // 'sv' locale → YYYY-MM-DD
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24),
  )
}

function getSubline(workouts: WorkoutRecord[]): string {
  if (workouts.length === 0) return '开始记录今天训练吧'
  const last = workouts[0]
  const today = localDateStr()
  const diff = daysBetween(today, last.date)
  if (diff === 0) return '今天已经练过了，很棒'
  if (diff === 1) return '昨天训练过，今天继续？'
  if (diff <= 3) return `${diff} 天前练过，随时都行`
  return '小人在等你，今天练了就很好'
}

const defaultAttrs: AttributesStore = {
  version: 1,
  items: {
    chest: { level: 1, xp: 0, totalXp: 0, lastChangedAt: null },
    shoulders: { level: 1, xp: 0, totalXp: 0, lastChangedAt: null },
    back: { level: 1, xp: 0, totalXp: 0, lastChangedAt: null },
    legs: { level: 1, xp: 0, totalXp: 0, lastChangedAt: null },
    arms: { level: 1, xp: 0, totalXp: 0, lastChangedAt: null },
    core: { level: 1, xp: 0, totalXp: 0, lastChangedAt: null },
    cardio: { level: 1, xp: 0, totalXp: 0, lastChangedAt: null },
  },
  lastWorkoutIdApplied: null,
}

const defaultProfile: ProfileStore = {
  version: 1,
  body: { heightCm: 170, currentWeightKg: 70, weightLogs: [] },
  goal: { type: 'maintain', targetWeightKg: null, targetDate: null },
  avatar: {
    skinTone: 'medium',
    hairStyle: 'short',
    hairColor: '#2a1d16',
    shirtColor: '#3b82f6',
    shortsColor: '#111827',
  },
}

export default function RpgHomeScreen({
  attributes,
  profile,
  workouts,
  onStartWorkout,
}: Props) {
  const [panelOpen, setPanelOpen] = useState(false)

  const displayAttrs = attributes ?? defaultAttrs
  const displayProfile = profile ?? defaultProfile
  const totalLevel = Object.values(displayAttrs.items).reduce((sum, s) => sum + s.level, 0)

  return (
    <div className="relative min-h-screen flex flex-col select-none overflow-hidden">

      {/* ── 主体（居中） ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pt-12 pb-4">
        <p className="font-pixel text-rpg-gold text-xs mb-1 tracking-wide">
          {getGreeting()}
        </p>
        <p className="text-rpg-muted text-xs mb-6 text-center leading-relaxed">
          {getSubline(workouts)}
        </p>

        {/* 像素小人（点击展开角色状态面板） */}
        <button
          onClick={() => setPanelOpen(true)}
          className="focus:outline-none group"
          aria-label="查看角色状态"
        >
          <PixelAvatarCanvas attributes={displayAttrs} profile={displayProfile} idle />
          <p className="text-rpg-muted text-xs mt-3 text-center group-hover:text-rpg-text transition-colors opacity-60">
            点击查看状态
          </p>
        </button>
      </div>

      {/* ── 主按钮 ────────────────────────────────────────── */}
      <div className="px-6 pb-10">
        <button
          onClick={onStartWorkout}
          className="w-full py-4 rounded-xl bg-rpg-accent hover:bg-purple-600 active:bg-purple-700 text-white font-bold text-lg transition-colors shadow-lg shadow-rpg-accent/25"
        >
          ⚔️ 记录今天训练
        </button>
      </div>

      {/* ── 角色状态面板 ──────────────────────────────────── */}
      {/* 遮罩 */}
      <div
        onClick={() => setPanelOpen(false)}
        className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-300 ${
          panelOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* 底部滑出面板 */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto
          bg-rpg-panel border-t border-rpg-border rounded-t-2xl
          transition-transform duration-300 ease-out
          ${panelOpen ? 'translate-y-0' : 'translate-y-full'}
        `}
      >
        {/* 面板头 */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-rpg-border">
          <span className="font-pixel text-rpg-gold text-xs">综合 Lv {totalLevel}</span>
          <button
            onClick={() => setPanelOpen(false)}
            className="text-rpg-muted hover:text-rpg-text text-2xl leading-none transition-colors"
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        {/* 7 属性 + XP 进度条 */}
        <div className="px-5 pt-4 pb-6 max-h-96 overflow-y-auto space-y-4">
          {ALL_ATTRIBUTES.map(key => (
            <AttributeBar
              key={key}
              attrKey={key}
              state={displayAttrs.items[key]}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
