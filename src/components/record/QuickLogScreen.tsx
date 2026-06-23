import { useState, useRef, useEffect } from 'react'
import { intakeApi } from '../../api/intake'
import type { TrainingDraft } from '../../api/intake'
import { workoutsApi } from '../../api/workouts'
import type { WorkoutProcessResult, FeelingType } from '../../domain/types'
import ExerciseRow, { type DraftExercise } from './ExerciseRow'

interface Props {
  onWorkoutSuccess: (result: WorkoutProcessResult) => void
  onExpand: (note: string, draft?: TrainingDraft) => void
  onCancel: () => void
}

type ParseState = 'idle' | 'parsing' | 'preview' | 'saving'

const PLACEHOLDERS = [
  '例如：卧推 3 组 10 次 60 公斤，跑步 30 分钟',
  '例如：深蹲 4×8，80 公斤',
  '例如：游泳 45 分钟',
  '例如：引体向上 3 组，手臂练了一下',
]

function getBlockingIssues(exercises: DraftExercise[]): string[] {
  if (exercises.length === 0) return ['尚未识别到任何训练动作']
  return exercises.flatMap((ex, i) => {
    const label = ex.name.trim() || `动作${i + 1}`
    const issues: string[] = []
    if (!ex.name.trim()) issues.push(`动作${i + 1} 的名称待补充`)
    if (ex.type === 'strength') {
      if (ex.sets <= 0) issues.push(`${label} 的组数待补充`)
      if (ex.reps <= 0) issues.push(`${label} 的次数待补充`)
    } else {
      if (ex.duration <= 0) issues.push(`${label} 的时长待补充`)
    }
    return issues
  })
}

export default function QuickLogScreen({ onWorkoutSuccess, onExpand, onCancel }: Props) {
  const [text, setText] = useState('')
  const [parseState, setParseState] = useState<ParseState>('idle')
  const [exercises, setExercises] = useState<DraftExercise[]>([])
  const [feeling, setFeeling] = useState<FeelingType>('ok')
  const [date, setDate] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])
  const [rawText, setRawText] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const placeholder = useRef(PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)]).current

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const currentDraft: TrainingDraft | null =
    parseState === 'preview' || parseState === 'saving'
      ? { date, feeling, exercises }
      : null

  const blockingIssues = getBlockingIssues(exercises)
  const canSave =
    (parseState === 'preview' || parseState === 'saving') && blockingIssues.length === 0

  // warnings 去重：过滤掉与 blocking issues 重复的"缺失字段"提示
  const displayedWarnings = warnings.filter(
    w => !w.includes('未明确') && !w.includes('请补充'),
  )

  const handleParse = async () => {
    const trimmed = text.trim()
    if (!trimmed) return
    setErrorMsg('')
    setParseState('parsing')
    try {
      const result = await intakeApi.parse(trimmed)
      setExercises(result.draft.exercises as DraftExercise[])
      setFeeling(result.draft.feeling)
      setDate(result.draft.date)
      setWarnings(result.warnings)
      setRawText(result.rawText)
      setParseState('preview')
    } catch (err) {
      setErrorMsg((err as Error).message || '解析失败，请重试')
      setParseState('idle')
    }
  }

  const handleSave = async () => {
    if (!currentDraft || !canSave) return
    setErrorMsg('')
    setParseState('saving')
    try {
      const result = await workoutsApi.create(currentDraft)
      onWorkoutSuccess(result)
    } catch (err) {
      setErrorMsg((err as Error).message || '保存失败，请重试')
      setParseState('preview')
    }
  }

  // 保留原文，回到输入阶段让用户继续修改
  const handleReset = () => {
    setExercises([])
    setWarnings([])
    setErrorMsg('')
    setParseState('idle')
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  const handleExpand = () => {
    onExpand(rawText || text.trim(), currentDraft ?? undefined)
  }

  const updateExercise = (index: number, ex: DraftExercise) => {
    setExercises(prev => prev.map((e, i) => (i === index ? ex : e)))
  }

  const removeExercise = (index: number) => {
    setExercises(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="min-h-screen flex flex-col px-5 pt-14 pb-8">
      <button
        onClick={onCancel}
        className="text-rpg-muted hover:text-rpg-text text-sm transition-colors mb-6 self-start"
      >
        ← 返回
      </button>

      {/* ── 输入区 ── */}
      {(parseState === 'idle' || parseState === 'parsing') && (
        <>
          <div className="mb-4">
            <h2 className="text-rpg-text text-xl font-bold mb-1">说说今天练了什么</h2>
            <p className="text-rpg-muted text-sm">随便说，不用格式</p>
          </div>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleParse()
            }}
            placeholder={placeholder}
            rows={5}
            disabled={parseState === 'parsing'}
            className="w-full bg-rpg-panel border border-rpg-border rounded-xl px-4 py-3
              text-rpg-text placeholder-rpg-muted text-base leading-relaxed
              focus:outline-none focus:border-rpg-accent transition-colors
              resize-none mb-4 disabled:opacity-60"
          />

          {errorMsg && (
            <p className="text-red-400 text-sm mb-3 px-1">{errorMsg}</p>
          )}

          <div className="space-y-3">
            <button
              onClick={handleParse}
              disabled={!text.trim() || parseState === 'parsing'}
              className="w-full py-4 rounded-xl bg-rpg-accent hover:bg-purple-600 active:bg-purple-700
                text-white font-bold text-base transition-colors shadow-lg shadow-rpg-accent/20
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {parseState === 'parsing' ? '正在理解训练内容...' : '整理记录'}
            </button>
            <button
              onClick={() => onExpand(text.trim())}
              disabled={parseState === 'parsing'}
              className="w-full py-3 rounded-xl border border-rpg-border text-rpg-muted
                hover:text-rpg-text hover:border-rpg-text transition-colors text-sm font-medium
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              展开详细编辑
            </button>
          </div>
        </>
      )}

      {/* ── 草稿编辑区 ── */}
      {(parseState === 'preview' || parseState === 'saving') && (
        <>
          {/* 日期（无 feeling 文案） */}
          <p className="text-rpg-muted text-xs mb-3">{date}</p>

          {/* 动作卡片列表 */}
          {exercises.length === 0 ? (
            <p className="text-rpg-muted text-sm mb-3">未识别到训练动作</p>
          ) : (
            <div className="mb-2">
              {exercises.map((ex, i) => (
                <ExerciseRow
                  key={i}
                  exercise={ex}
                  index={i}
                  onChange={updateExercise}
                  onRemove={removeExercise}
                  compact
                />
              ))}
            </div>
          )}

          {/* 信息类 warnings（已过滤"缺失字段"重复项） */}
          {displayedWarnings.length > 0 && (
            <div className="mb-3 space-y-1">
              {displayedWarnings.map((w, i) => (
                <p key={i} className="text-rpg-muted text-xs leading-relaxed">· {w}</p>
              ))}
            </div>
          )}

          {/* blocking issues */}
          {blockingIssues.length > 0 && (
            <div className="mb-3 space-y-1">
              {blockingIssues.map((issue, i) => (
                <p key={i} className="text-yellow-400 text-xs">· {issue}</p>
              ))}
            </div>
          )}

          {errorMsg && (
            <p className="text-red-400 text-sm mb-3 px-1">{errorMsg}</p>
          )}

          <div className="space-y-3 mt-2">
            <button
              onClick={handleSave}
              disabled={!canSave || parseState === 'saving'}
              className="w-full py-4 rounded-xl bg-rpg-accent hover:bg-purple-600 active:bg-purple-700
                text-white font-bold text-base transition-colors shadow-lg shadow-rpg-accent/20
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {parseState === 'saving'
                ? '保存中...'
                : blockingIssues.length > 0
                  ? '补完缺失信息后保存'
                  : '确认保存'}
            </button>
            <button
              onClick={handleExpand}
              disabled={parseState === 'saving'}
              className="w-full py-3 rounded-xl border border-rpg-border text-rpg-muted
                hover:text-rpg-text hover:border-rpg-text transition-colors text-sm font-medium
                disabled:opacity-40"
            >
              展开详细编辑
            </button>
            <button
              onClick={handleReset}
              disabled={parseState === 'saving'}
              className="w-full py-2 text-rpg-muted hover:text-rpg-text text-sm transition-colors
                disabled:opacity-40"
            >
              返回修改原文
            </button>
          </div>
        </>
      )}
    </div>
  )
}
