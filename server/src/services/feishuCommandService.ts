import { previewTrainingTextMany, commitTrainingDraft } from './intakeWorkflowService'
import type { TrainingDraft } from './intakeWorkflowService'
import { getRecentWorkouts, getTodayWorkouts, getLastExercise, getWorkoutsWithExercise, sortedWorkouts, localToday } from './feishuQueryService'
import { getAllWorkouts, deleteWorkout } from '../repositories/workoutRepo'
import { getMuscleMapStore } from '../repositories/configRepo'
import { recalculateFromWorkouts } from './attributeService'
import { updateWorkout, isSimpleWorkoutEdit, type WorkoutEditPatch } from './workoutEditService'
import {
  duplicateWorkoutGroupKey,
  findDuplicateWorkoutsForDraft,
  formatDuplicateWorkoutLine,
  normalizeExerciseNameForDuplicate,
} from './workoutDuplicateService'
import {
  isLikelyWorkoutEditRequest,
  parseWorkoutEditRequest,
  type ParsedWorkoutEdit,
} from './feishuWorkoutEditIntentService'
import {
  detectIntent,
  ruleMatchFollowupAdvice,
  ruleMatchCancelPending,
  ruleMatchCapabilities,
  type IntentType,
} from './feishuIntentService'
import {
  fmtDraftPreview,
  fmtSaveSuccess,
  fmtUndoSuccess,
  fmtMissingField,
  fmtWorkoutSummary,
  HELP_TEXT,
  CAPABILITIES_TEXT,
} from './feishuFormatter'
import { parseLoosePositiveInt } from '../utils/numberParser'
import { localDateStr } from '../utils/date'
import {
  buildMissingFieldErrorHint,
  getMissingFieldRange,
} from '../utils/missingFieldRange'
import { isLikelyMissingFieldAnswer } from '../utils/missingFieldAnswer'
import { parseAthleteCommand, handleAthleteCommand } from './feishuAthleteCommandService'
import {
  getSession,
  buildSessionSummary,
  recordSessionFromTurn,
  type LastAdviceContext,
  type ActiveTopic,
} from './feishuSessionService'
import { summarizeAdviceReply } from './trainingAdviceService'
import { enqueueFeishuAutoSync, getFeishuSyncStatusText } from './feishuAutoSyncService'
import { runFeishuBaseSync } from './feishuBaseSyncService'
import {
  buildSyncFailedCard,
  buildSyncStatusCard,
  buildSyncSuccessCard,
  buildWorkoutListCard,
  buildWorkoutSavedBatchCard,
  buildWorkoutSavedCard,
  type FeishuCard,
} from './feishuCardService'
import type { WorkoutProcessResult, WorkoutRecord } from '../domain/types'

// ─── 常量 ─────────────────────────────────────────────────────────────────────

const DRAFT_TTL_MS = 10 * 60 * 1000
const UNDO_TTL_MS = 10 * 60 * 1000
const EDIT_TTL_MS = 10 * 60 * 1000
const INTENT_CONFIDENCE_THRESHOLD = 0.75
const AUTO_SAVE_CONFIDENCE = 0.85
const PENDING_CANCEL_PREFIX = '已取消这条待补充记录，先聊训练建议。\n\n'

// ─── Pending Draft 状态机 ─────────────────────────────────────────────────────

type PendingStatus = 'waiting_confirm' | 'waiting_missing_field'

interface MissingFieldInfo {
  exerciseIndex: number
  fieldName: 'sets' | 'reps' | 'duration'
  exerciseLabel: string
}

interface PendingEntry {
  draft: TrainingDraft
  status: PendingStatus
  missingField?: MissingFieldInfo
  expiresAt: number
}

const pendingDrafts = new Map<string, PendingEntry>()

function draftKey(chatId: string, senderId: string): string {
  return `${chatId}:${senderId}`
}

function setPendingConfirm(chatId: string, senderId: string, draft: TrainingDraft): void {
  pendingDrafts.set(draftKey(chatId, senderId), {
    draft,
    status: 'waiting_confirm',
    expiresAt: Date.now() + DRAFT_TTL_MS,
  })
}

function setPendingMissingField(
  chatId: string,
  senderId: string,
  draft: TrainingDraft,
  missingField: MissingFieldInfo,
): void {
  pendingDrafts.set(draftKey(chatId, senderId), {
    draft,
    status: 'waiting_missing_field',
    missingField,
    expiresAt: Date.now() + DRAFT_TTL_MS,
  })
}

function getPendingEntry(chatId: string, senderId: string): PendingEntry | null {
  const entry = pendingDrafts.get(draftKey(chatId, senderId))
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    pendingDrafts.delete(draftKey(chatId, senderId))
    return null
  }
  return entry
}

function clearPending(chatId: string, senderId: string): void {
  pendingDrafts.delete(draftKey(chatId, senderId))
}

export function getPendingStateSummary(chatId: string, senderId: string): {
  status: 'none' | 'waiting_confirm' | 'waiting_missing_field'
  missingFieldName?: 'sets' | 'reps' | 'duration'
  exerciseLabel?: string
  exerciseName?: string
} {
  const entry = getPendingEntry(chatId, senderId)
  if (!entry) return { status: 'none' }

  if (entry.status === 'waiting_confirm') {
    return { status: 'waiting_confirm' }
  }

  const ex = entry.missingField
    ? entry.draft.exercises[entry.missingField.exerciseIndex]
    : undefined

  return {
    status: 'waiting_missing_field',
    missingFieldName: entry.missingField?.fieldName,
    exerciseLabel: entry.missingField?.exerciseLabel,
    exerciseName: ex?.name,
  }
}

function formatPendingStateForIntent(chatId: string, senderId: string): string {
  const s = getPendingStateSummary(chatId, senderId)
  if (s.status === 'none') return 'none'
  if (s.status === 'waiting_confirm') return 'waiting_confirm'
  return `waiting_missing_field: ${s.exerciseName ?? '未知动作'} ${s.missingFieldName ?? ''}`
}

// ─── Last Saved（撤销支持）────────────────────────────────────────────────────

interface LastSavedWorkoutRef {
  workoutId: string
  workoutDate: string
}

interface LastSavedEntry {
  workouts: LastSavedWorkoutRef[]
  expiresAt: number
}

const lastSavedWorkouts = new Map<string, LastSavedEntry>()

function setLastSavedOperation(chatId: string, senderId: string, workouts: LastSavedWorkoutRef[]): void {
  lastSavedWorkouts.set(draftKey(chatId, senderId), {
    workouts,
    expiresAt: Date.now() + UNDO_TTL_MS,
  })
}

function setLastSaved(chatId: string, senderId: string, workoutId: string, workoutDate: string): void {
  setLastSavedOperation(chatId, senderId, [{ workoutId, workoutDate }])
}

function getLastSaved(chatId: string, senderId: string): LastSavedEntry | null {
  const entry = lastSavedWorkouts.get(draftKey(chatId, senderId))
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    lastSavedWorkouts.delete(draftKey(chatId, senderId))
    return null
  }
  return entry
}

function clearLastSaved(chatId: string, senderId: string): void {
  lastSavedWorkouts.delete(draftKey(chatId, senderId))
}

// ─── Pending Edit（修改确认/候选选择）──────────────────────────────────────────

type PendingEditStatus = 'selecting_target' | 'waiting_confirm'

interface PendingEditEntry {
  patch: WorkoutEditPatch
  parsed: ParsedWorkoutEdit
  candidateWorkoutIds: string[]
  selectedWorkoutId?: string
  status: PendingEditStatus
  expiresAt: number
}

const pendingEdits = new Map<string, PendingEditEntry>()
const referencedWorkouts = new Map<string, { workoutIds: string[]; expiresAt: number }>()

function setPendingEdit(chatId: string, senderId: string, entry: Omit<PendingEditEntry, 'expiresAt'>): void {
  pendingEdits.set(draftKey(chatId, senderId), {
    ...entry,
    expiresAt: Date.now() + EDIT_TTL_MS,
  })
}

function getPendingEdit(chatId: string, senderId: string): PendingEditEntry | null {
  const entry = pendingEdits.get(draftKey(chatId, senderId))
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    pendingEdits.delete(draftKey(chatId, senderId))
    return null
  }
  return entry
}

function clearPendingEdit(chatId: string, senderId: string): void {
  pendingEdits.delete(draftKey(chatId, senderId))
}

function setReferencedWorkouts(chatId: string, senderId: string, workouts: WorkoutRecord[]): void {
  referencedWorkouts.set(draftKey(chatId, senderId), {
    workoutIds: workouts.map(w => w.id),
    expiresAt: Date.now() + EDIT_TTL_MS,
  })
}

function getReferencedWorkoutIds(chatId: string, senderId: string): string[] {
  const entry = referencedWorkouts.get(draftKey(chatId, senderId))
  if (!entry) return []
  if (Date.now() > entry.expiresAt) {
    referencedWorkouts.delete(draftKey(chatId, senderId))
    return []
  }
  return entry.workoutIds
}

// ─── Pending Delete（删除历史训练记录）────────────────────────────────────────

type PendingDeleteStatus = 'selecting_target' | 'waiting_confirm'

interface PendingDeleteEntry {
  candidateWorkoutIds: string[]
  selectedWorkoutId?: string
  status: PendingDeleteStatus
  expiresAt: number
}

const pendingDeletes = new Map<string, PendingDeleteEntry>()

function setPendingDelete(chatId: string, senderId: string, entry: Omit<PendingDeleteEntry, 'expiresAt'>): void {
  pendingDeletes.set(draftKey(chatId, senderId), {
    ...entry,
    expiresAt: Date.now() + EDIT_TTL_MS,
  })
}

function getPendingDelete(chatId: string, senderId: string): PendingDeleteEntry | null {
  const entry = pendingDeletes.get(draftKey(chatId, senderId))
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    pendingDeletes.delete(draftKey(chatId, senderId))
    return null
  }
  return entry
}

function clearPendingDelete(chatId: string, senderId: string): void {
  pendingDeletes.delete(draftKey(chatId, senderId))
}

// ─── 规则命令识别（fallback）──────────────────────────────────────────────────

type CommandType =
  | 'help'
  | 'capabilities'
  | 'recent'
  | 'today'
  | 'last_exercise'
  | 'confirm'
  | 'undo'
  | 'record'
  | 'edit'
  | 'delete_workout'
  | 'athlete'
  | 'sync_dashboard'
  | 'open_dashboard'
  | 'sync_status'
  | 'unknown'

interface ParsedCommand {
  type: CommandType
  payload?: string
}

const TODAY_QUERY_PATTERNS = [
  /^今天练了什么/,
  /^今天记录$/,
  /^今日训练$/,
  /^今天有没有练/,
  /^查今天/,
]

const RECORD_PATTERN =
  /[0-9]|卧推|深蹲|硬拉|跑步|引体|游泳|骑行|跳绳|肩推|弯举|俯卧撑|组|次|kg|公斤|分钟/

function parseCommand(text: string, activeTopic?: ActiveTopic): ParsedCommand {
  const t = text.trim()
  const athleteCmd = parseAthleteCommand(t)
  if (athleteCmd) return { type: 'athlete', payload: JSON.stringify(athleteCmd) }
  if (t === '帮助' || t === '/help') return { type: 'help' }
  if (ruleMatchCapabilities(t)) return { type: 'capabilities' }
  if (isDashboardSyncRequest(t)) return { type: 'sync_dashboard' }
  if (isSyncStatusRequest(t)) return { type: 'sync_status' }
  if (isDashboardOpenRequest(t)) return { type: 'open_dashboard' }
  if (t === '确认' || t === '是' || t === '好的') return { type: 'confirm' }
  if (isDeleteWorkoutRequest(t)) return { type: 'delete_workout', payload: t }
  if (isSafeUndoCommand(t)) return { type: 'undo' }
  if (isLikelyWorkoutEditRequest(t)) return { type: 'edit', payload: t }
  if (/^(最近|近期|最近训练|近期训练|查看最近|查看近期|最近记录|近期记录)(\d+条|训练|记录)?$/.test(t) ||
    (/最近|近期|近几次|最近几次/.test(t) && /训练|记录|练/.test(t))) {
    return { type: 'recent' }
  }
  if (TODAY_QUERY_PATTERNS.some(p => p.test(t))) return { type: 'today' }
  if (t.startsWith('上次')) {
    const exerciseName = t.replace(/^上次/, '').trim()
    return { type: 'last_exercise', payload: exerciseName || undefined }
  }
  if (t.startsWith('记录') || t.startsWith('帮我记')) {
    const body = t.replace(/^(记录|帮我记)\s*/, '').trim()
    return { type: 'record', payload: body || t }
  }
  // advice 上下文下禁用宽匹配，避免「我想加大深蹲重量」被当成记录
  if (activeTopic !== 'advice' && RECORD_PATTERN.test(t)) {
    return { type: 'record', payload: t }
  }
  return { type: 'unknown' }
}

function isSafeUndoCommand(text: string): boolean {
  const t = text.trim()
  if (isDashboardSyncRequest(t)) return false
  if (/看板|多维表格|数据中心|飞书表格|base/i.test(t) && /同步|刷新|更新|没同步|没有同步|漏同步/.test(t)) {
    return false
  }
  if (/^(撤销|撤销刚才|撤销上一条|删掉刚才|删掉上一条|删除刚才|删除上一条|取消刚才那条|取消上一条)$/.test(t)) {
    return true
  }

  const hasUndoVerb = /撤销|删除|删掉|取消|去掉|移除/.test(t)
  const hasRecentTarget = /刚刚|刚才|上一条|上一次|这次|本次|刚保存|刚记录|刚才那个|刚刚那个|这条|那条/.test(t)
  const hasRecordTarget = /训练记录|训练|记录/.test(t)
  return hasUndoVerb && hasRecentTarget && hasRecordTarget
}

function isDeleteWorkoutRequest(text: string): boolean {
  const t = text.trim()
  if (/重复/.test(t) && /检查|查看|有没有|列出|找|清理|删除|删|去掉|移除/.test(t)) return true
  if (!/删除|删掉|删|去掉|移除/.test(t)) return false
  if (/记录里|记录里的|训练里|训练里的|动作/.test(t)) return false
  if (/撤销/.test(t)) return false
  return /记录|训练|重复|6\.\d|6月|月\d/.test(t)
}

function isDashboardSyncRequest(text: string): boolean {
  const t = text.trim()
  if (/^(同步看板|刷新看板|同步训练看板|更新飞书看板)$/.test(t)) return true
  const mentionsDashboard = /看板|多维表格|数据中心|飞书表格|base/i.test(t)
  const wantsSync = /同步|刷新|更新|没同步|没有同步|漏同步|重新同步/.test(t)
  return mentionsDashboard && wantsSync
}

function isDashboardOpenRequest(text: string): boolean {
  const t = text.trim()
  if (/^(打开训练看板|打开看板|训练看板)$/.test(t)) return true
  return /看板|多维表格|数据中心|飞书表格|base/i.test(t) && /打开|看看|看一下|查看|查|入口|链接|在哪/.test(t)
}

function isSyncStatusRequest(text: string): boolean {
  const t = text.trim()
  if (/^(查看同步状态|同步状态)$/.test(t)) return true
  return /同步/.test(t) && /状态|情况|成功|完成|好了|最新/.test(t)
}

// ─── 保存并记录 lastSaved ─────────────────────────────────────────────────────

async function doSave(
  chatId: string,
  senderId: string,
  draft: TrainingDraft,
  withUndo = true,
): Promise<{ text: string; card: FeishuCard }> {
  const result = commitTrainingDraft(draft, 'feishu')
  setLastSaved(chatId, senderId, result.workout.id, result.workout.date)
  setReferencedWorkouts(chatId, senderId, [result.workout])
  return {
    text: fmtSaveSuccess(result, withUndo),
    card: buildWorkoutSavedCard(result),
  }
}

async function doSaveMany(
  chatId: string,
  senderId: string,
  drafts: TrainingDraft[],
): Promise<{ text: string; card: FeishuCard; results: WorkoutProcessResult[] }> {
  const results = drafts.map(draft => commitTrainingDraft(draft, 'feishu'))
  setReferencedWorkouts(chatId, senderId, results.map(result => result.workout))
  setLastSavedOperation(
    chatId,
    senderId,
    results.map(result => ({
      workoutId: result.workout.id,
      workoutDate: result.workout.date,
    })),
  )

  const text = [
    `已记录 ${results.length} 次训练`,
    '',
    ...results.flatMap(result => [
      result.workout.date,
      ...result.workout.exercises.map(ex => `  ${ex.name}`),
      '',
    ]),
    `回复"撤销"可删除本次保存的 ${results.length} 条记录（10分钟内有效）`,
  ].join('\n').trim()

  return {
    text,
    card: buildWorkoutSavedBatchCard(results),
    results,
  }
}

function doUndo(chatId: string, senderId: string): string {
  const entry = getLastSaved(chatId, senderId)
  if (!entry) return '没有可撤销的记录（超过 10 分钟或从未保存）'

  const deletedDates: string[] = []
  for (const workout of entry.workouts) {
    if (deleteWorkout(workout.workoutId)) {
      deletedDates.push(workout.workoutDate)
    }
  }

  if (deletedDates.length === 0) return '撤销失败：记录可能已不存在'
  clearLastSaved(chatId, senderId)
  const remaining = getAllWorkouts()
  recalculateFromWorkouts(remaining)
  enqueueFeishuAutoSync('workout_undo')

  const dates = Array.from(new Set(deletedDates)).join('、')
  if (deletedDates.length === 1) return fmtUndoSuccess(dates)
  return `已删除本次保存的 ${deletedDates.length} 条训练记录（${dates}），属性已还原`
}

// ─── 缺失字段追问 ─────────────────────────────────────────────────────────────

function buildMissingFieldInfo(
  draft: TrainingDraft,
  blockingMessage: string,
): MissingFieldInfo | null {
  for (let i = 0; i < draft.exercises.length; i++) {
    const ex = draft.exercises[i]
    if (ex.type === 'strength') {
      if (blockingMessage.includes(ex.name) && blockingMessage.includes('组数')) {
        return { exerciseIndex: i, fieldName: 'sets', exerciseLabel: buildExerciseLabel(ex) }
      }
      if (blockingMessage.includes(ex.name) && blockingMessage.includes('次数')) {
        return { exerciseIndex: i, fieldName: 'reps', exerciseLabel: buildExerciseLabel(ex) }
      }
    } else {
      if (blockingMessage.includes(ex.name) && blockingMessage.includes('时长')) {
        return { exerciseIndex: i, fieldName: 'duration', exerciseLabel: buildExerciseLabel(ex) }
      }
    }
  }
  return null
}

function buildExerciseLabel(ex: TrainingDraft['exercises'][number]): string {
  if (ex.type === 'strength') {
    const weight = ex.weight > 0 ? `${ex.weight}${ex.unit} ` : ''
    const note = ex.note ? `[${ex.note}] ` : ''
    return `${weight}${note}${ex.name}`
  }
  return ex.name
}

async function handleMissingFieldReply(
  chatId: string,
  senderId: string,
  entry: PendingEntry & { status: 'waiting_missing_field'; missingField: MissingFieldInfo },
  text: string,
): Promise<RoutedResult> {
  const newExercises = [...entry.draft.exercises]
  const ex = { ...newExercises[entry.missingField.exerciseIndex] }
  const exerciseType = ex.type
  const exerciseName = ex.name
  const range = getMissingFieldRange(entry.missingField.fieldName, exerciseName, exerciseType)
  const value = parseLoosePositiveInt(text)

  if (value === null || value < range.min || value > range.max) {
    return {
      finalReply: buildMissingFieldErrorHint(
        entry.missingField.fieldName,
        range,
        exerciseName,
        exerciseType,
      ),
      sessionIntent: 'record_workout',
      activeTopic: 'recording',
      activeExerciseName: exerciseName,
    }
  }

  if (ex.type === 'strength' && entry.missingField.fieldName !== 'duration') {
    if (entry.missingField.fieldName === 'sets') (ex as typeof ex & { sets: number }).sets = value
    if (entry.missingField.fieldName === 'reps') (ex as typeof ex & { reps: number }).reps = value
  } else if (ex.type === 'cardio') {
    (ex as typeof ex & { duration: number }).duration = value
  }
  newExercises[entry.missingField.exerciseIndex] = ex

  const updatedDraft: TrainingDraft = { ...entry.draft, exercises: newExercises }
  const { getBlockingIssues } = await import('./intakeWorkflowService')
  const remaining = getBlockingIssues(updatedDraft)

  clearPending(chatId, senderId)

  if (remaining.length === 0) {
    const reply = await doSave(chatId, senderId, updatedDraft)
    return {
      finalReply: reply.text,
      finalCard: reply.card,
      sessionIntent: 'record_workout',
      activeTopic: 'recording',
      activeExerciseName: exerciseName,
    }
  }

  return {
    finalReply: '还有信息未填完，请重新发送完整训练记录',
    sessionIntent: 'record_workout',
    activeTopic: 'recording',
  }
}

function formatDuplicateWarning(draft: TrainingDraft, duplicates: WorkoutRecord[]): string {
  return [
    '这条训练看起来可能已经记录过了，我先不直接重复写入。',
    '',
    '准备记录：',
    formatDuplicateWorkoutLine({
      id: 'draft',
      source: 'feishu',
      date: draft.date,
      feeling: draft.feeling,
      exercises: draft.exercises.map((ex, index) => ({ ...ex, id: `draft_${index}` })) as WorkoutRecord['exercises'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    '',
    '已有记录：',
    ...duplicates.slice(0, 3).map(workout => `- ${workoutDeleteSummary(workout)}`),
    '',
    '如果确实要重复保存，请回复「确认」；如果不需要，回复「取消」。',
  ].join('\n')
}

async function handleRecord(
  chatId: string,
  senderId: string,
  text: string,
  autoSaveAllowed: boolean,
): Promise<RoutedResult> {
  const multiPreview = await previewTrainingTextMany(text)
  const meaningfulItems = multiPreview.items.filter(item => item.draft.exercises.length > 0)
  const shouldAutoSaveMulti = autoSaveAllowed || /记录|记一下|帮我记|记进去|保存/.test(text)

  if (meaningfulItems.length > 1) {
    const duplicateItems = meaningfulItems
      .map(item => ({ item, duplicates: findDuplicateWorkoutsForDraft(item.draft) }))
      .filter(item => item.duplicates.length > 0)

    if (duplicateItems.length > 0) {
      return {
        immediateReply: '收到，正在整理...',
        finalReply: [
          `我识别到 ${meaningfulItems.length} 天训练，其中有 ${duplicateItems.length} 条疑似重复。`,
          '',
          ...duplicateItems.map(({ item, duplicates }) =>
            `${item.draft.date}：${formatDuplicateWorkoutLine(duplicates[0])}`,
          ),
          '',
          '为了避免重复写入，请分天发送，或修改后再发。',
        ].join('\n'),
        sessionIntent: 'record_workout_duplicate',
        activeTopic: 'recording',
      }
    }

    const blocking = meaningfulItems.flatMap(item =>
      item.blockingIssues.map(issue => `${item.draft.date}：${issue.message}`),
    )

    if (blocking.length > 0) {
      return {
        immediateReply: '收到，正在整理...',
        finalReply: `我识别到 ${meaningfulItems.length} 天训练，但还有信息未补全：\n${blocking.join('\n')}\n\n请补充后重新发送，或分天发送。`,
        sessionIntent: 'record_workout',
        activeTopic: 'recording',
      }
    }

    if (shouldAutoSaveMulti) {
      const saved = await doSaveMany(chatId, senderId, meaningfulItems.map(item => item.draft))
      return {
        immediateReply: '收到，识别到多天训练，正在分别保存...',
        finalReply: saved.text,
        finalCard: saved.card,
        sessionIntent: 'record_workout',
        activeTopic: 'recording',
        activeExerciseName: meaningfulItems[0]?.draft.exercises[0]?.name,
      }
    }

    return {
      immediateReply: '收到，正在整理...',
      finalReply: `我识别到 ${meaningfulItems.length} 天训练。为了避免误存，请加一句「帮我记录」或分天发送。`,
      sessionIntent: 'record_workout',
      activeTopic: 'recording',
    }
  }

  const singleItem = meaningfulItems[0] ?? multiPreview.items[0]
  const preview = {
    rawText: multiPreview.rawText,
    draft: singleItem.draft,
    warnings: multiPreview.warnings,
    blockingIssues: singleItem.blockingIssues,
  }
  const firstExercise = preview.draft.exercises[0]?.name
  const duplicates = findDuplicateWorkoutsForDraft(preview.draft)

  if (preview.blockingIssues.length === 0 && autoSaveAllowed) {
    if (duplicates.length > 0) {
      setPendingConfirm(chatId, senderId, preview.draft)
      return {
        immediateReply: '收到，正在整理...',
        finalReply: formatDuplicateWarning(preview.draft, duplicates),
        sessionIntent: 'record_workout_duplicate',
        activeTopic: 'recording',
        activeExerciseName: firstExercise,
      }
    }
    const reply = await doSave(chatId, senderId, preview.draft)
    return {
      immediateReply: '收到，正在整理...',
      finalReply: reply.text,
      finalCard: reply.card,
      sessionIntent: 'record_workout',
      activeTopic: 'recording',
      activeExerciseName: firstExercise,
    }
  }

  if (preview.blockingIssues.length === 1) {
    const issue = preview.blockingIssues[0].message
    const missingField = buildMissingFieldInfo(preview.draft, issue)
    if (missingField) {
      setPendingMissingField(chatId, senderId, preview.draft, missingField)
      return {
        immediateReply: '收到，正在整理...',
        finalReply: fmtMissingField(missingField.exerciseLabel, missingField.fieldName),
        sessionIntent: 'record_workout',
        activeTopic: 'recording',
        activeExerciseName: preview.draft.exercises[missingField.exerciseIndex]?.name,
      }
    }
  }

  if (preview.blockingIssues.length > 0) {
    const issue = preview.blockingIssues[0].message
    return {
      immediateReply: '收到，正在整理...',
      finalReply: `还差一个信息：\n${issue}\n\n请补充后重新发送`,
      sessionIntent: 'record_workout',
      activeTopic: 'recording',
    }
  }

  setPendingConfirm(chatId, senderId, preview.draft)
  const infoWarnings = preview.warnings.filter(
    w => !w.includes('未明确') && !w.includes('请补充'),
  )
  if (duplicates.length > 0) {
    return {
      immediateReply: '收到，正在整理...',
      finalReply: formatDuplicateWarning(preview.draft, duplicates),
      sessionIntent: 'record_workout_duplicate',
      activeTopic: 'recording',
      activeExerciseName: firstExercise,
    }
  }
  return {
    immediateReply: '收到，正在整理...',
    finalReply: fmtDraftPreview(preview.draft, infoWarnings),
    sessionIntent: 'record_workout',
    activeTopic: 'recording',
    activeExerciseName: firstExercise,
  }
}

async function handleAdvice(
  chatId: string,
  senderId: string,
  text: string,
  intent: IntentType,
  exerciseName?: string,
  hadPending = false,
): Promise<RoutedResult> {
  const session = getSession(chatId, senderId)
  const prefix = hadPending ? PENDING_CANCEL_PREFIX : ''

  if (intent === 'followup_advice' && session?.lastAdviceContext) {
    const { getFollowupTrainingAdvice } = await import('./trainingAdviceService')
    const reply = await getFollowupTrainingAdvice(
      text,
      session.lastAdviceContext,
      buildSessionSummary(session),
      session.activeExerciseName,
    )
    const adviceContext: LastAdviceContext = {
      userQuestion: text,
      answerSummary: summarizeAdviceReply(reply),
      exerciseName: exerciseName ?? session.lastAdviceContext.exerciseName,
    }
    return {
      immediateReply: '正在结合上轮建议思考...',
      finalReply: prefix + reply,
      sessionIntent: 'followup_advice',
      activeTopic: 'advice',
      activeExerciseName: adviceContext.exerciseName,
      lastAdviceContext: adviceContext,
    }
  }

  const { getTrainingAdvice } = await import('./trainingAdviceService')
  const reply = await getTrainingAdvice(text)
  const adviceContext: LastAdviceContext = {
    userQuestion: text,
    answerSummary: summarizeAdviceReply(reply),
    exerciseName,
  }
  return {
    immediateReply: '正在查看你的训练历史...',
    finalReply: prefix + reply,
    sessionIntent: 'training_advice',
    activeTopic: 'advice',
    activeExerciseName: exerciseName,
    lastAdviceContext: adviceContext,
  }
}

// ─── 删除历史训练记录 ─────────────────────────────────────────────────────────

function parseWorkoutDateFromText(text: string): string | null {
  if (/前天/.test(text)) return localDateStr(-2)
  if (/昨天|昨日/.test(text)) return localDateStr(-1)
  if (/今天|今日/.test(text)) return localDateStr()
  const explicit = text.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/)
  if (explicit) {
    return `${explicit[1]}-${explicit[2].padStart(2, '0')}-${explicit[3].padStart(2, '0')}`
  }
  const md = text.match(/(\d{1,2})\s*(?:[/.月])\s*(\d{1,2})日?/)
  if (md) {
    const year = localDateStr().slice(0, 4)
    return `${year}-${md[1].padStart(2, '0')}-${md[2].padStart(2, '0')}`
  }
  return null
}

function workoutDeleteSummary(workout: WorkoutRecord): string {
  return `${formatDuplicateWorkoutLine(workout)}（创建：${workout.createdAt.slice(0, 16).replace('T', ' ')}）`
}

function filterDuplicateCandidates(workouts: WorkoutRecord[]): WorkoutRecord[] {
  const groups = new Map<string, WorkoutRecord[]>()
  workouts.forEach(workout => {
    const key = duplicateWorkoutGroupKey(workout)
    const group = groups.get(key) ?? []
    group.push(workout)
    groups.set(key, group)
  })
  return Array.from(groups.values()).filter(group => group.length > 1).flat()
}

function extractDeleteExerciseName(text: string): string | null {
  const candidates = getMuscleMapStore().items
    .filter(entry => entry.enabled)
    .flatMap(entry => [entry.exerciseName, ...entry.aliases])
    .sort((a, b) => b.length - a.length)

  for (const name of candidates) {
    if (name && text.includes(name)) return normalizeExerciseNameForDuplicate(name)
  }
  return null
}

function resolveDeleteCandidates(text: string): WorkoutRecord[] {
  const date = parseWorkoutDateFromText(text)
  const exerciseName = extractDeleteExerciseName(text)
  let candidates = sortedWorkouts()
  if (date) candidates = candidates.filter(workout => workout.date === date)
  if (exerciseName) {
    candidates = candidates.filter(workout =>
      workout.exercises.some(ex => normalizeExerciseNameForDuplicate(ex.name) === exerciseName),
    )
  }
  if (/重复/.test(text)) candidates = filterDuplicateCandidates(candidates)
  return candidates.slice(0, 8)
}

function formatDeleteCandidateList(candidates: WorkoutRecord[]): string {
  const lines = ['我找到了几条可能要删除的训练记录，请回复序号：', '']
  candidates.forEach((workout, index) => {
    lines.push(`${index + 1}. ${workoutDeleteSummary(workout)}`)
  })
  lines.push('', '删除整条记录需要确认。也可以回复「取消删除」。')
  return lines.join('\n')
}

function formatDeletePreview(workout: WorkoutRecord): string {
  return [
    '请确认删除这条训练记录：',
    '',
    fmtWorkoutSummary(workout),
    '',
    '回复「确认删除」执行，或回复「取消删除」。',
  ].join('\n')
}

function applyDeleteWorkout(chatId: string, senderId: string, workoutId: string): RoutedResult {
  const workout = sortedWorkouts().find(w => w.id === workoutId)
  if (!workout) {
    clearPendingDelete(chatId, senderId)
    return {
      finalReply: '这条训练记录已经不存在。',
      sessionIntent: 'delete_workout_failed',
      activeTopic: 'recording',
    }
  }
  const ok = deleteWorkout(workoutId)
  clearPendingDelete(chatId, senderId)
  if (!ok) {
    return {
      finalReply: '删除失败：记录可能已不存在。',
      sessionIntent: 'delete_workout_failed',
      activeTopic: 'recording',
    }
  }
  recalculateFromWorkouts(getAllWorkouts())
  enqueueFeishuAutoSync('workout_deleted')
  return {
    finalReply: `已删除训练记录：\n${workoutDeleteSummary(workout)}\n\n属性已重新计算，飞书看板会自动同步。`,
    sessionIntent: 'delete_workout',
    activeTopic: 'recording',
  }
}

async function handleDeleteWorkoutRequest(
  chatId: string,
  senderId: string,
  text: string,
): Promise<RoutedResult> {
  const candidates = resolveDeleteCandidates(text)
  if (candidates.length === 0) {
    return {
      finalReply: '没找到可删除的训练记录。可以说「删除 6.13 的重复记录」或「删除昨天的训练记录」。',
      sessionIntent: 'delete_workout',
      activeTopic: 'recording',
    }
  }

  const selected = parseSelection(text)
  if (selected && candidates[selected - 1]) {
    const workout = candidates[selected - 1]
    setPendingDelete(chatId, senderId, {
      candidateWorkoutIds: candidates.map(w => w.id),
      selectedWorkoutId: workout.id,
      status: 'waiting_confirm',
    })
    return {
      finalReply: formatDeletePreview(workout),
      sessionIntent: 'delete_workout_preview',
      activeTopic: 'recording',
    }
  }

  if (candidates.length === 1) {
    setPendingDelete(chatId, senderId, {
      candidateWorkoutIds: [candidates[0].id],
      selectedWorkoutId: candidates[0].id,
      status: 'waiting_confirm',
    })
    return {
      finalReply: formatDeletePreview(candidates[0]),
      sessionIntent: 'delete_workout_preview',
      activeTopic: 'recording',
    }
  }

  setPendingDelete(chatId, senderId, {
    candidateWorkoutIds: candidates.map(w => w.id),
    status: 'selecting_target',
  })
  return {
    finalReply: formatDeleteCandidateList(candidates),
    sessionIntent: 'select_delete_target',
    activeTopic: 'recording',
  }
}

function isDeleteConfirm(text: string): boolean {
  return /^(确认删除|确认|删掉|删除)$/.test(text.trim())
}

function isDeleteCancel(text: string): boolean {
  return /^(取消删除|取消|先不删|不删了)$/.test(text.trim())
}

function handlePendingDeleteReply(
  chatId: string,
  senderId: string,
  text: string,
  entry: PendingDeleteEntry,
): RoutedResult | null {
  if (isDeleteCancel(text)) {
    clearPendingDelete(chatId, senderId)
    return {
      finalReply: '好的，已取消删除。',
      sessionIntent: 'cancel_delete',
      activeTopic: 'idle',
    }
  }

  if (entry.status === 'selecting_target') {
    const selected = parseSelection(text)
    if (!selected) return null
    const workoutId = entry.candidateWorkoutIds[selected - 1]
    const workout = workoutId ? sortedWorkouts().find(w => w.id === workoutId) : undefined
    if (!workout) {
      return {
        finalReply: '这个序号不在候选列表里，请重新选择，或回复「取消删除」。',
        sessionIntent: 'select_delete_target',
        activeTopic: 'recording',
      }
    }
    setPendingDelete(chatId, senderId, {
      ...entry,
      selectedWorkoutId: workoutId,
      status: 'waiting_confirm',
    })
    return {
      finalReply: formatDeletePreview(workout),
      sessionIntent: 'delete_workout_preview',
      activeTopic: 'recording',
    }
  }

  if (entry.status === 'waiting_confirm' && isDeleteConfirm(text)) {
    const workoutId = entry.selectedWorkoutId ?? entry.candidateWorkoutIds[0]
    return applyDeleteWorkout(chatId, senderId, workoutId)
  }

  return null
}

// ─── 修改训练记录 ─────────────────────────────────────────────────────────────

function operationNeedsConfirmation(patch: WorkoutEditPatch): boolean {
  return !isSimpleWorkoutEdit(patch) ||
    patch.operations.some(op => op.type === 'remove_exercise' || op.type === 'add_exercise')
}

function extractEditExerciseName(parsed: ParsedWorkoutEdit): string | undefined {
  if (parsed.targetExerciseName) return parsed.targetExerciseName
  for (const op of parsed.patch.operations) {
    if ('exerciseName' in op && op.exerciseName) return op.exerciseName
  }
  return undefined
}

function workoutHasExercise(workout: WorkoutRecord, exerciseName?: string): boolean {
  if (!exerciseName) return true
  const needle = exerciseName.trim().toLowerCase()
  return workout.exercises.some(ex =>
    ex.name.toLowerCase().includes(needle) || needle.includes(ex.name.toLowerCase()),
  )
}

function resolveEditCandidates(
  chatId: string,
  senderId: string,
  text: string,
  parsed: ParsedWorkoutEdit,
): WorkoutRecord[] {
  const all = sortedWorkouts()
  const mentionsRecent = /刚才|刚刚|上一条|上一次|刚保存|刚记录|这条|那条/.test(text)
  const exerciseName = extractEditExerciseName(parsed)

  let candidates: WorkoutRecord[] = []
  if (mentionsRecent) {
    const last = getLastSaved(chatId, senderId)
    const ids = last?.workouts.map(w => w.workoutId) ?? getReferencedWorkoutIds(chatId, senderId)
    candidates = ids
      .map(id => all.find(w => w.id === id))
      .filter((w): w is WorkoutRecord => Boolean(w))
  }

  if (candidates.length === 0) {
    const referencedIds = getReferencedWorkoutIds(chatId, senderId)
    candidates = referencedIds
      .map(id => all.find(w => w.id === id))
      .filter((w): w is WorkoutRecord => Boolean(w))
  }

  if (candidates.length === 0) candidates = all
  candidates = candidates.filter(w => workoutHasExercise(w, exerciseName)).slice(0, 5)
  return candidates
}

function formatEditCandidateList(candidates: WorkoutRecord[]): string {
  const lines = ['我找到了几条可能要修改的记录，请回复序号：', '']
  candidates.forEach((workout, index) => {
    const names = workout.exercises.map(ex => ex.name).join('、')
    lines.push(`${index + 1}. ${workout.date}  ${names}`)
  })
  lines.push('', '也可以回复「取消修改」。')
  return lines.join('\n')
}

function formatEditPreview(workout: WorkoutRecord, patch: WorkoutEditPatch): string {
  const planned = patch.operations.map(op => {
    if (op.type === 'set_date') return `日期 → ${op.value}`
    if (op.type === 'set_feeling') return `状态感受 → ${op.value}`
    if (op.type === 'set_exercise_field') return `${op.exerciseName ?? '该动作'} ${op.field} → ${op.value}`
    if (op.type === 'set_exercise_note') return `${op.exerciseName ?? '该动作'} 备注 → ${op.value}`
    if (op.type === 'remove_exercise') return `删除动作：${op.exerciseName ?? '未指定'}`
    return `新增动作：${op.exercise.name}`
  })
  return [
    '请确认这次修改：',
    '',
    fmtWorkoutSummary(workout),
    '',
    '将修改：',
    ...planned.map(line => `- ${line}`),
    '',
    '回复「确认修改」执行，或回复「取消修改」。',
  ].join('\n')
}

function formatEditSuccess(result: ReturnType<typeof updateWorkout>): string {
  return [
    '训练记录已修改',
    '',
    ...result.changedFields.map(line => `- ${line}`),
    '',
    fmtWorkoutSummary(result.workout),
    '',
    '属性已按全部训练记录重新计算，飞书看板会自动同步。',
  ].join('\n')
}

function applyPendingOrParsedEdit(
  chatId: string,
  senderId: string,
  workoutId: string,
  patch: WorkoutEditPatch,
): RoutedResult {
  const result = updateWorkout(workoutId, patch)
  clearPendingEdit(chatId, senderId)
  setReferencedWorkouts(chatId, senderId, [result.workout])
  return {
    finalReply: formatEditSuccess(result),
    sessionIntent: 'edit_workout',
    activeTopic: 'recording',
    activeExerciseName: result.workout.exercises[0]?.name,
  }
}

async function handleEditRequest(
  chatId: string,
  senderId: string,
  text: string,
): Promise<RoutedResult> {
  const parsed = await parseWorkoutEditRequest(text)
  if (!parsed) {
    return {
      finalReply: '我没识别到要怎么修改。可以说「刚才日期改成昨天」或「把卧推重量改成45kg」。',
      sessionIntent: 'edit_workout',
      activeTopic: 'recording',
    }
  }

  const candidates = resolveEditCandidates(chatId, senderId, text, parsed)
  if (candidates.length === 0) {
    return {
      finalReply: '没找到可修改的训练记录。请补充日期或动作，例如「把昨天的卧推重量改成45kg」。',
      sessionIntent: 'edit_workout',
      activeTopic: 'recording',
    }
  }

  if (candidates.length > 1) {
    setPendingEdit(chatId, senderId, {
      patch: parsed.patch,
      parsed,
      candidateWorkoutIds: candidates.map(w => w.id),
      status: 'selecting_target',
    })
    return {
      finalReply: formatEditCandidateList(candidates),
      sessionIntent: 'select_edit_target',
      activeTopic: 'recording',
    }
  }

  const candidate = candidates[0]
  const needsConfirmation = parsed.requiresConfirmation ||
    parsed.confidence < 0.8 ||
    operationNeedsConfirmation(parsed.patch)

  if (needsConfirmation) {
    setPendingEdit(chatId, senderId, {
      patch: parsed.patch,
      parsed,
      candidateWorkoutIds: [candidate.id],
      selectedWorkoutId: candidate.id,
      status: 'waiting_confirm',
    })
    return {
      finalReply: formatEditPreview(candidate, parsed.patch),
      sessionIntent: 'edit_workout_preview',
      activeTopic: 'recording',
    }
  }

  try {
    return applyPendingOrParsedEdit(chatId, senderId, candidate.id, parsed.patch)
  } catch (err) {
    return {
      finalReply: `修改失败：${(err as Error).message}`,
      sessionIntent: 'edit_workout_failed',
      activeTopic: 'recording',
    }
  }
}

function parseSelection(text: string): number | null {
  const t = text.trim()
  if (/^[1-5]$/.test(t)) return Number(t)
  const match = t.match(/(?:选|第)\s*([1-5一二三四五])/)
  if (!match) return null
  const map: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5 }
  return map[match[1]] ?? Number(match[1])
}

function isEditConfirm(text: string): boolean {
  return /^(确认修改|确认|就这样改|好的|可以)$/.test(text.trim())
}

function isEditCancel(text: string): boolean {
  return /^(取消修改|取消|先不改|不改了)$/.test(text.trim())
}

function handlePendingEditReply(
  chatId: string,
  senderId: string,
  text: string,
  entry: PendingEditEntry,
): RoutedResult | null {
  if (isEditCancel(text)) {
    clearPendingEdit(chatId, senderId)
    return {
      finalReply: '好的，已取消这次修改。',
      sessionIntent: 'cancel_edit',
      activeTopic: 'idle',
    }
  }

  if (entry.status === 'selecting_target') {
    const selected = parseSelection(text)
    if (!selected) return null
    const workoutId = entry.candidateWorkoutIds[selected - 1]
    if (!workoutId) {
      return {
        finalReply: '这个序号不在候选列表里，请重新选择，或回复「取消修改」。',
        sessionIntent: 'select_edit_target',
        activeTopic: 'recording',
      }
    }
    const workout = sortedWorkouts().find(w => w.id === workoutId)
    if (!workout) {
      clearPendingEdit(chatId, senderId)
      return {
        finalReply: '这条记录已经不存在，请重新发起修改。',
        sessionIntent: 'edit_workout_failed',
        activeTopic: 'recording',
      }
    }
    setPendingEdit(chatId, senderId, {
      ...entry,
      selectedWorkoutId: workoutId,
      status: 'waiting_confirm',
    })
    return {
      finalReply: formatEditPreview(workout, entry.patch),
      sessionIntent: 'edit_workout_preview',
      activeTopic: 'recording',
    }
  }

  if (entry.status === 'waiting_confirm' && isEditConfirm(text)) {
    const workoutId = entry.selectedWorkoutId ?? entry.candidateWorkoutIds[0]
    try {
      return applyPendingOrParsedEdit(chatId, senderId, workoutId, entry.patch)
    } catch (err) {
      clearPendingEdit(chatId, senderId)
      return {
        finalReply: `修改失败：${(err as Error).message}`,
        sessionIntent: 'edit_workout_failed',
        activeTopic: 'recording',
      }
    }
  }

  return null
}

// ─── 主入口 ───────────────────────────────────────────────────────────────────

export interface HandleResult {
  immediateReply?: string
  finalReply: string
  finalCard?: FeishuCard
}

interface RoutedResult extends HandleResult {
  sessionIntent: string
  activeTopic?: ActiveTopic
  activeExerciseName?: string
  lastAdviceContext?: LastAdviceContext
}

function wrapAndRecord(
  chatId: string,
  senderId: string,
  userText: string,
  result: RoutedResult,
): HandleResult {
  recordSessionFromTurn(chatId, senderId, {
    userText,
    intent: result.sessionIntent,
    botReply: result.finalReply,
    activeTopic: result.activeTopic,
    activeExerciseName: result.activeExerciseName,
    lastAdviceContext: result.lastAdviceContext,
  })
  return {
    immediateReply: result.immediateReply,
    finalReply: result.finalReply,
    finalCard: result.finalCard,
  }
}

function canRouteIntent(intentType: IntentType, confidence: number, text: string): boolean {
  if (confidence >= INTENT_CONFIDENCE_THRESHOLD) return true
  if (intentType === 'undo_last') return false
  const nonDestructive: IntentType[] = [
    'query_recent',
    'query_today',
    'query_last_exercise',
    'query_athlete_profile',
    'query_goals',
    'query_strength_levels',
    'training_advice',
    'followup_advice',
    'query_capabilities',
    'sync_dashboard',
    'open_dashboard',
    'sync_status',
    'help',
  ]
  if (!nonDestructive.includes(intentType)) return false
  if (confidence >= 0.55) return true
  if (intentType === 'open_dashboard' && /看板|多维表格|数据中心/.test(text)) return true
  if (intentType === 'sync_status' && /同步/.test(text)) return true
  return false
}

function shouldTrustRecordIntent(confidence: number, text: string): boolean {
  if (confidence >= INTENT_CONFIDENCE_THRESHOLD) return true
  return confidence >= 0.65 && /记录|帮我记|记一下|记进去|保存/.test(text)
}

async function routeByIntent(
  chatId: string,
  senderId: string,
  text: string,
  intentType: IntentType,
  exerciseName: string | undefined,
  confidence: number,
  hadPending: boolean,
): Promise<RoutedResult | null> {
  switch (intentType) {
    case 'help':
    case 'query_capabilities':
      return { finalReply: CAPABILITIES_TEXT, sessionIntent: intentType, activeTopic: 'idle' }

    case 'clarify_question':
      return {
        finalReply: '我没太理解你的意思。你是想记录训练、查历史，还是问训练建议？',
        sessionIntent: 'clarify_question',
        activeTopic: 'idle',
      }

    case 'cancel_pending':
      clearPending(chatId, senderId)
      return {
        finalReply: '好的，已取消待处理记录。需要时重新发训练内容即可。',
        sessionIntent: 'cancel_pending',
        activeTopic: 'idle',
      }

    case 'query_recent':
      setReferencedWorkouts(chatId, senderId, sortedWorkouts().slice(0, 5))
      return {
        finalReply: getRecentWorkouts(),
        finalCard: buildWorkoutListCard('近期训练', sortedWorkouts().slice(0, 5)),
        sessionIntent: 'query_recent',
        activeTopic: 'query',
      }

    case 'query_today':
      setReferencedWorkouts(chatId, senderId, sortedWorkouts().filter(w => w.date === localToday()))
      return {
        finalReply: getTodayWorkouts(),
        finalCard: buildWorkoutListCard('今日训练', sortedWorkouts().filter(w => w.date === localToday())),
        sessionIntent: 'query_today',
        activeTopic: 'query',
      }

    case 'query_last_exercise':
      if (!exerciseName) {
        return {
          finalReply: '请告诉我要查哪个动作，例如"上次卧推"',
          sessionIntent: 'query_last_exercise',
          activeTopic: 'query',
        }
      }
      setReferencedWorkouts(chatId, senderId, getWorkoutsWithExercise(exerciseName, 5))
      return {
        finalReply: getLastExercise(exerciseName),
        sessionIntent: 'query_last_exercise',
        activeTopic: 'query',
        activeExerciseName: exerciseName,
      }

    case 'confirm_pending': {
      const entry = getPendingEntry(chatId, senderId)
      if (!entry) {
        return {
          finalReply: '没有待确认的训练记录，请先发送训练内容',
          sessionIntent: 'confirm_pending',
          activeTopic: 'recording',
        }
      }
      clearPending(chatId, senderId)
      const reply = await doSave(chatId, senderId, entry.draft)
      return {
        finalReply: reply.text,
        finalCard: reply.card,
        sessionIntent: 'confirm_pending',
        activeTopic: 'recording',
      }
    }

    case 'undo_last':
      if (!isSafeUndoCommand(text)) {
        return {
          finalReply: isDashboardSyncRequest(text)
            ? '我理解你是想把数据同步到看板，不会删除训练记录。'
            : '这句话不像明确的撤销命令。为了避免误删，请只发送「撤销」或「撤销上一条」。',
          sessionIntent: 'undo_guarded',
          activeTopic: 'idle',
        }
      }
      return { finalReply: doUndo(chatId, senderId), sessionIntent: 'undo_last', activeTopic: 'idle' }

    case 'sync_dashboard': {
      try {
        const syncResult = runFeishuBaseSync('manual_bot')
        return {
          immediateReply: '正在刷新训练看板...',
          finalReply: `训练看板已同步\n训练记录：${syncResult.counts.workouts} 条\n动作明细：${syncResult.counts.exerciseLogs} 条`,
          finalCard: buildSyncSuccessCard(syncResult),
          sessionIntent: 'sync_dashboard',
          activeTopic: 'query',
        }
      } catch (err) {
        const message = (err as Error).message
        return {
          immediateReply: '正在刷新训练看板...',
          finalReply: `看板同步失败：${message}`,
          finalCard: buildSyncFailedCard(message),
          sessionIntent: 'sync_dashboard_failed',
          activeTopic: 'query',
        }
      }
    }

    case 'open_dashboard':
    case 'sync_status': {
      const status = getFeishuSyncStatusText()
      return {
        finalReply: status,
        finalCard: buildSyncStatusCard(status),
        sessionIntent: intentType,
        activeTopic: 'query',
      }
    }

    case 'record_workout': {
      const autoSave = confidence >= AUTO_SAVE_CONFIDENCE
      return handleRecord(chatId, senderId, text, autoSave)
    }

    case 'edit_workout':
      return handleEditRequest(chatId, senderId, text)

    case 'confirm_edit': {
      const pending = getPendingEdit(chatId, senderId)
      if (!pending) {
        return {
          finalReply: '没有待确认的修改。',
          sessionIntent: 'confirm_edit',
          activeTopic: 'recording',
        }
      }
      return handlePendingEditReply(chatId, senderId, '确认修改', pending) ?? {
        finalReply: '这次修改还需要先选择记录。',
        sessionIntent: 'confirm_edit',
        activeTopic: 'recording',
      }
    }

    case 'cancel_edit':
      clearPendingEdit(chatId, senderId)
      return {
        finalReply: '好的，已取消这次修改。',
        sessionIntent: 'cancel_edit',
        activeTopic: 'idle',
      }

    case 'training_advice':
    case 'followup_advice':
      if (hadPending) clearPending(chatId, senderId)
      return handleAdvice(chatId, senderId, text, intentType, exerciseName, hadPending)

    case 'query_athlete_profile':
    case 'query_goals':
    case 'query_strength_levels':
    case 'update_athlete_field': {
      const athleteCmd = parseAthleteCommand(text)
      if (athleteCmd) {
        return {
          finalReply: handleAthleteCommand(athleteCmd),
          sessionIntent: intentType,
          activeTopic: 'profile',
        }
      }
      return {
        finalReply: '没理解这条体能表命令，可以说「查看体能表」或「我的目标」',
        sessionIntent: intentType,
        activeTopic: 'profile',
      }
    }

    default:
      return null
  }
}

async function routeByCommand(
  chatId: string,
  senderId: string,
  text: string,
  cmd: ParsedCommand,
): Promise<RoutedResult> {
  switch (cmd.type) {
    case 'help':
    case 'capabilities':
      return { finalReply: CAPABILITIES_TEXT, sessionIntent: 'help', activeTopic: 'idle' }

    case 'recent':
      setReferencedWorkouts(chatId, senderId, sortedWorkouts().slice(0, 5))
      return {
        finalReply: getRecentWorkouts(),
        finalCard: buildWorkoutListCard('近期训练', sortedWorkouts().slice(0, 5)),
        sessionIntent: 'query_recent',
        activeTopic: 'query',
      }

    case 'today':
      setReferencedWorkouts(chatId, senderId, sortedWorkouts().filter(w => w.date === localToday()))
      return {
        finalReply: getTodayWorkouts(),
        finalCard: buildWorkoutListCard('今日训练', sortedWorkouts().filter(w => w.date === localToday())),
        sessionIntent: 'query_today',
        activeTopic: 'query',
      }

    case 'last_exercise':
      if (!cmd.payload) {
        return {
          finalReply: '请指定动作名，例如「上次卧推」',
          sessionIntent: 'query_last_exercise',
          activeTopic: 'query',
        }
      }
      setReferencedWorkouts(chatId, senderId, getWorkoutsWithExercise(cmd.payload, 5))
      return {
        finalReply: getLastExercise(cmd.payload),
        sessionIntent: 'query_last_exercise',
        activeTopic: 'query',
        activeExerciseName: cmd.payload,
      }

    case 'undo':
      return { finalReply: doUndo(chatId, senderId), sessionIntent: 'undo_last', activeTopic: 'idle' }

    case 'confirm': {
      const entry = getPendingEntry(chatId, senderId)
      if (!entry) {
        return {
          finalReply: '没有待确认的训练记录',
          sessionIntent: 'confirm_pending',
          activeTopic: 'recording',
        }
      }
      clearPending(chatId, senderId)
      const reply = await doSave(chatId, senderId, entry.draft)
      return {
        finalReply: reply.text,
        finalCard: reply.card,
        sessionIntent: 'confirm_pending',
        activeTopic: 'recording',
      }
    }

    case 'record':
      return handleRecord(
        chatId,
        senderId,
        cmd.payload ?? text,
        text.startsWith('记录') || text.startsWith('帮我记'),
      )

    case 'edit':
      return handleEditRequest(chatId, senderId, cmd.payload ?? text)

    case 'delete_workout':
      return handleDeleteWorkoutRequest(chatId, senderId, cmd.payload ?? text)

    case 'athlete': {
      if (!cmd.payload) {
        return { finalReply: '体能表命令解析失败', sessionIntent: 'unknown', activeTopic: 'idle' }
      }
      const athleteCmd = JSON.parse(cmd.payload)
      return {
        finalReply: handleAthleteCommand(athleteCmd),
        sessionIntent: 'update_athlete_field',
        activeTopic: 'profile',
      }
    }

    case 'sync_dashboard': {
      try {
        const syncResult = runFeishuBaseSync('manual_bot')
        return {
          immediateReply: '正在刷新训练看板...',
          finalReply: `训练看板已同步\n训练记录：${syncResult.counts.workouts} 条\n动作明细：${syncResult.counts.exerciseLogs} 条`,
          finalCard: buildSyncSuccessCard(syncResult),
          sessionIntent: 'sync_dashboard',
          activeTopic: 'query',
        }
      } catch (err) {
        const message = (err as Error).message
        return {
          immediateReply: '正在刷新训练看板...',
          finalReply: `看板同步失败：${message}`,
          finalCard: buildSyncFailedCard(message),
          sessionIntent: 'sync_dashboard_failed',
          activeTopic: 'query',
        }
      }
    }

    case 'open_dashboard':
    case 'sync_status': {
      const status = getFeishuSyncStatusText()
      return {
        finalReply: status,
        finalCard: buildSyncStatusCard(status),
        sessionIntent: cmd.type,
        activeTopic: 'query',
      }
    }

    default:
      return {
        finalReply: '回复"帮助"查看支持的操作',
        sessionIntent: 'unknown',
        activeTopic: 'idle',
      }
  }
}

export async function handleFeishuMessage(
  chatId: string,
  senderId: string,
  text: string,
): Promise<HandleResult> {
  const session = getSession(chatId, senderId)
  const pendingEntry = getPendingEntry(chatId, senderId)
  const pendingEdit = getPendingEdit(chatId, senderId)
  const pendingDelete = getPendingDelete(chatId, senderId)
  const hadPending = pendingEntry !== null

  if (pendingDelete) {
    const deleteReply = handlePendingDeleteReply(chatId, senderId, text, pendingDelete)
    if (deleteReply) return wrapAndRecord(chatId, senderId, text, deleteReply)
  }

  if (pendingEdit) {
    const editReply = handlePendingEditReply(chatId, senderId, text, pendingEdit)
    if (editReply) return wrapAndRecord(chatId, senderId, text, editReply)
  }

  // waiting_missing_field：仅明显数字补充才走补字段
  if (
    pendingEntry?.status === 'waiting_missing_field' &&
    pendingEntry.missingField &&
    isLikelyMissingFieldAnswer(text)
  ) {
    const result = await handleMissingFieldReply(
      chatId,
      senderId,
      pendingEntry as PendingEntry & { status: 'waiting_missing_field'; missingField: MissingFieldInfo },
      text,
    )
    return wrapAndRecord(chatId, senderId, text, result)
  }

  // 规则快速路径
  if (pendingEntry && ruleMatchCancelPending(text)) {
    clearPending(chatId, senderId)
    const result: RoutedResult = {
      finalReply: '好的，已取消待处理记录。需要时重新发训练内容即可。',
      sessionIntent: 'cancel_pending',
      activeTopic: 'idle',
    }
    return wrapAndRecord(chatId, senderId, text, result)
  }

  if (ruleMatchCapabilities(text)) {
    const result: RoutedResult = {
      finalReply: CAPABILITIES_TEXT,
      sessionIntent: 'query_capabilities',
      activeTopic: 'idle',
    }
    return wrapAndRecord(chatId, senderId, text, result)
  }

  if (isDashboardSyncRequest(text)) {
    const result = await routeByCommand(chatId, senderId, text, { type: 'sync_dashboard' })
    return wrapAndRecord(chatId, senderId, text, result)
  }

  if (isSyncStatusRequest(text)) {
    const result = await routeByCommand(chatId, senderId, text, { type: 'sync_status' })
    return wrapAndRecord(chatId, senderId, text, result)
  }

  if (isDashboardOpenRequest(text)) {
    const result = await routeByCommand(chatId, senderId, text, { type: 'open_dashboard' })
    return wrapAndRecord(chatId, senderId, text, result)
  }

  if (isDeleteWorkoutRequest(text)) {
    const result = await handleDeleteWorkoutRequest(chatId, senderId, text)
    return wrapAndRecord(chatId, senderId, text, result)
  }

  if (isLikelyWorkoutEditRequest(text)) {
    const result = await handleEditRequest(chatId, senderId, text)
    return wrapAndRecord(chatId, senderId, text, result)
  }

  // AI 意图识别（带上下文）
  let intentType: IntentType = 'unknown'
  let exerciseName: string | undefined
  let confidence = 0

  try {
    const intent = await detectIntent({
      text,
      sessionSummary: buildSessionSummary(session),
      pendingState: formatPendingStateForIntent(chatId, senderId),
    })
    intentType = intent.intent
    exerciseName = intent.exerciseName
    confidence = intent.confidence

    // 规则增强：advice 上下文 + 承接词
    if (
      ruleMatchFollowupAdvice(text, session?.activeTopic) &&
      confidence < INTENT_CONFIDENCE_THRESHOLD
    ) {
      intentType = 'followup_advice'
      confidence = 0.8
    }
  } catch {
    // intent 失败走规则
    if (ruleMatchFollowupAdvice(text, session?.activeTopic)) {
      intentType = 'followup_advice'
      confidence = 0.8
    }
  }

  if (intentType === 'record_workout' && !shouldTrustRecordIntent(confidence, text)) {
    intentType = 'unknown'
  }

  if (canRouteIntent(intentType, confidence, text)) {
    const routed = await routeByIntent(
      chatId,
      senderId,
      text,
      intentType,
      exerciseName,
      confidence,
      hadPending,
    )
    if (routed) return wrapAndRecord(chatId, senderId, text, routed)
  }

  // 低置信度：规则 fallback（advice 上下文禁用宽 record 匹配）
  const cmd = parseCommand(text, session?.activeTopic)

  // pending 补字段时，宽匹配 record 但不像数字补充 → 优先当建议而非补字段
  if (
    cmd.type === 'record' &&
    pendingEntry?.status === 'waiting_missing_field' &&
    !isLikelyMissingFieldAnswer(text)
  ) {
    clearPending(chatId, senderId)
    const adviceResult = await handleAdvice(
      chatId,
      senderId,
      text,
      session?.activeTopic === 'advice' ? 'followup_advice' : 'training_advice',
      exerciseName,
      true,
    )
    return wrapAndRecord(chatId, senderId, text, adviceResult)
  }

  // pending 时非数字补充：其他明确命令清除 pending
  if (hadPending && cmd.type !== 'unknown' && cmd.type !== 'record') {
    clearPending(chatId, senderId)
  }

  const result = await routeByCommand(chatId, senderId, text, cmd)
  return wrapAndRecord(chatId, senderId, text, result)
}
