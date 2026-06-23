import { chatJson } from './aiClientService'
import { localDateStr } from '../utils/date'
import type { FeelingType } from '../domain/types'
import type { WorkoutEditOperation, WorkoutEditPatch } from './workoutEditService'

export interface ParsedWorkoutEdit {
  patch: WorkoutEditPatch
  targetExerciseName?: string
  targetDate?: string
  confidence: number
  requiresConfirmation: boolean
}

function normalizeFeeling(text: string): FeelingType | null {
  if (/很棒|超好|状态好/.test(text)) return 'great'
  if (/不错|挺好|还行|可以/.test(text)) return 'good'
  if (/一般|普通|还好/.test(text)) return 'ok'
  if (/累|疲惫/.test(text)) return 'tired'
  if (/难受|不舒服|很差/.test(text)) return 'bad'
  return null
}

function parseDateValue(text: string): string | null {
  if (/前天/.test(text)) return localDateStr(-2)
  if (/昨天|昨日/.test(text)) return localDateStr(-1)
  if (/今天|今日/.test(text)) return localDateStr()
  const explicit = text.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/)
  if (explicit) {
    const [, y, m, d] = explicit
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const md = text.match(/(\d{1,2})[/.月](\d{1,2})日?/)
  if (md) {
    const year = localDateStr().slice(0, 4)
    return `${year}-${md[1].padStart(2, '0')}-${md[2].padStart(2, '0')}`
  }
  return null
}

function cleanExerciseName(raw: string | undefined): string | undefined {
  const cleaned = raw
    ?.trim()
    .replace(/^(把|给|刚才|刚刚|上一条|上一次|这条|那条|的)+/, '')
    .replace(/(那条|这条|记录|训练|动作|的)$/g, '')
    .trim()
  if (!cleaned || /刚才|刚刚|上一条|这条|那条|记录|训练/.test(cleaned)) return undefined
  return cleaned
}

function extractExerciseName(text: string): string | undefined {
  const patterns = [
    /把(.+?)(?:重量|组数|次数|时长|备注|删掉|删除|改成|改为)/,
    /(.+?)(?:重量|组数|次数|时长)(?:记错|错了|不对|应该|应为)/,
    /(?:刚才|刚刚|上一条|这条|那条)?(.+?)不是.+?(?:是|为)/,
    /(?:删掉|删除|去掉|移除)(?:刚才|刚刚|上一条|这条|那条)?(?:的)?(?:记录|训练)?(?:里|里的|中|中的|的)?(.+?)(?:$|，|,|。)/,
    /(?:给|把)(.+?)(?:加备注|备注)/,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    const name = cleanExerciseName(match?.[1])
    if (name) return name
  }
  return undefined
}

function parseNumber(text: string): number | null {
  const match = text.match(/(负|-)?\s*(\d+(?:\.\d+)?)/)
  if (!match) return null
  const value = Number(match[2])
  return match[1] ? -value : value
}

function parseTargetNumber(text: string): number | null {
  const matches = Array.from(text.matchAll(/(负|-)?\s*(\d+(?:\.\d+)?)/g))
  if (matches.length === 0) return null
  const toNumber = (match: RegExpMatchArray): number => {
    const value = Number(match[2])
    return match[1] ? -value : value
  }
  if (/不是|记错|错了|不对|应该|应为|改成|改为/.test(text)) {
    return toNumber(matches[matches.length - 1])
  }
  return toNumber(matches[0])
}

function ruleParseEdit(text: string): ParsedWorkoutEdit | null {
  const t = text.trim()
  const operations: WorkoutEditOperation[] = []
  const targetExerciseName = extractExerciseName(t)
  const correctionLike = /不是|记错|错了|不对|应该是|应为|应该为/.test(t)

  if (/日期|时间|哪天/.test(t) && /改|纠正|不对|错|换|应该|应为/.test(t)) {
    const date = parseDateValue(t)
    if (date) operations.push({ type: 'set_date', value: date })
  }

  if (/状态|感觉|感受/.test(t) && /改|设|换|纠正|不对|错|应该|应为/.test(t)) {
    const feeling = normalizeFeeling(t)
    if (feeling) operations.push({ type: 'set_feeling', value: feeling })
  }

  if (/重量/.test(t) && /改|纠正|不对|错|换|应该|应为/.test(t)) {
    const value = parseTargetNumber(t)
    if (value !== null) operations.push({ type: 'set_exercise_field', exerciseName: targetExerciseName, field: 'weight', value })
  }

  if (/组数|几组/.test(t) && /改|纠正|不对|错|换|应该|应为/.test(t)) {
    const value = parseTargetNumber(t)
    if (value !== null) operations.push({ type: 'set_exercise_field', exerciseName: targetExerciseName, field: 'sets', value })
  }

  if (/次数|每组|几个|几次/.test(t) && /改|纠正|不对|错|换|应该|应为/.test(t)) {
    const value = parseTargetNumber(t)
    if (value !== null) operations.push({ type: 'set_exercise_field', exerciseName: targetExerciseName, field: 'reps', value })
  }

  if (/时长|分钟|有氧/.test(t) && /改|纠正|不对|错|换|应该|应为/.test(t)) {
    const value = parseTargetNumber(t)
    if (value !== null) operations.push({ type: 'set_exercise_field', exerciseName: targetExerciseName, field: 'duration', value })
  }

  if (operations.length === 0 && correctionLike) {
    const value = parseTargetNumber(t)
    if (value !== null) {
      if (/分钟|小时|时长/.test(t)) {
        operations.push({ type: 'set_exercise_field', exerciseName: targetExerciseName, field: 'duration', value })
      } else if (/kg|公斤|千克|斤|重量/.test(t)) {
        operations.push({ type: 'set_exercise_field', exerciseName: targetExerciseName, field: 'weight', value })
      } else if (/组/.test(t)) {
        operations.push({ type: 'set_exercise_field', exerciseName: targetExerciseName, field: 'sets', value })
      } else if (/次|个|每组/.test(t)) {
        operations.push({ type: 'set_exercise_field', exerciseName: targetExerciseName, field: 'reps', value })
      }
    }
  }

  const noteMatch = t.match(/(?:备注|加备注|补备注)[:：]?\s*(.+)$/)
  if (noteMatch) {
    operations.push({ type: 'set_exercise_note', exerciseName: targetExerciseName, value: noteMatch[1].trim() })
  }

  if (/删掉|删除|去掉|移除/.test(t) && !/上一条|整条|训练记录/.test(t)) {
    const name = targetExerciseName
    if (name) operations.push({ type: 'remove_exercise', exerciseName: name })
  }

  if (operations.length === 0) return null
  return {
    patch: { operations },
    targetExerciseName,
    targetDate: parseDateValue(t) ?? undefined,
    confidence: 0.85,
    requiresConfirmation: operations.some(op => op.type === 'remove_exercise' || op.type === 'add_exercise') || operations.length > 1,
  }
}

async function aiParseEdit(text: string): Promise<ParsedWorkoutEdit | null> {
  const today = localDateStr()
  const yesterday = localDateStr(-1)
  const result = await chatJson<{
    operations: Array<{
      type: WorkoutEditOperation['type']
      field?: 'sets' | 'reps' | 'weight' | 'duration'
      value?: string | number
      exerciseName?: string | null
    }>
    targetExerciseName?: string | null
    confidence?: number
    requiresConfirmation?: boolean
  }>(
    [
      {
        role: 'system',
        content: `你是训练记录修改解析器。只输出 JSON，不要解释。
今天=${today}，昨天=${yesterday}。
只允许输出 operations 数组，类型：
- set_date value=YYYY-MM-DD
- set_feeling value=great|good|ok|tired|bad
- set_exercise_field field=sets|reps|weight|duration value=number exerciseName可选
- set_exercise_note value=string exerciseName可选
- remove_exercise exerciseName必填
不要输出完整训练记录，不要猜测没有说出的字段。删除动作和多字段修改 requiresConfirmation=true。`,
      },
      { role: 'user', content: text },
    ],
    { timeoutMs: 5000, temperature: 0 },
  )

  if (!Array.isArray(result?.operations) || result.operations.length === 0) return null
  const operations: WorkoutEditOperation[] = []
  for (const op of result.operations) {
    if (op.type === 'set_date' && typeof op.value === 'string') {
      operations.push({ type: 'set_date', value: op.value })
    } else if (op.type === 'set_feeling' && typeof op.value === 'string') {
      const feeling = normalizeFeeling(op.value) ?? (['great', 'good', 'ok', 'tired', 'bad'].includes(op.value) ? op.value as FeelingType : null)
      if (feeling) operations.push({ type: 'set_feeling', value: feeling })
    } else if (op.type === 'set_exercise_field' && op.field && typeof op.value === 'number') {
      operations.push({ type: 'set_exercise_field', exerciseName: op.exerciseName ?? undefined, field: op.field, value: op.value })
    } else if (op.type === 'set_exercise_note' && typeof op.value === 'string') {
      operations.push({ type: 'set_exercise_note', exerciseName: op.exerciseName ?? undefined, value: op.value })
    } else if (op.type === 'remove_exercise' && op.exerciseName) {
      operations.push({ type: 'remove_exercise', exerciseName: op.exerciseName })
    }
  }
  if (operations.length === 0) return null
  const operationExerciseName = operations
    .map(op => ('exerciseName' in op ? op.exerciseName : undefined))
    .find(Boolean)
  return {
    patch: { operations },
    targetExerciseName: result.targetExerciseName ?? operationExerciseName,
    confidence: typeof result.confidence === 'number' ? result.confidence : 0.7,
    requiresConfirmation: result.requiresConfirmation === true || operations.length > 1 || operations.some(op => op.type === 'remove_exercise'),
  }
}

export function isLikelyWorkoutEditRequest(text: string): boolean {
  const t = text.trim()
  if (/看板|同步|刷新/.test(t)) return false
  if (/撤销上一条|撤销刚才|删掉上一条|删除上一条|删除训练记录/.test(t)) return false
  return /日期不对|时间不对|重量不对|组数不对|次数不对|时长不对|改成|改为|修改|纠正|加备注|补备注|删掉.*(?:里|中的)?|不是.+(?:是|为)|记错|错了|应该是|应为|应该为/.test(t)
}

export async function parseWorkoutEditRequest(text: string): Promise<ParsedWorkoutEdit | null> {
  return ruleParseEdit(text) ?? await aiParseEdit(text)
}
