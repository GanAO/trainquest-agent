import { getMuscleMapStore } from '../repositories/configRepo'
import { chatJson } from './aiClientService'
import type { FeelingType } from '../domain/types'
import { localDateStr } from '../utils/date'

type StrengthInput = {
  type: 'strength'
  name: string
  sets: number
  reps: number
  weight: number
  unit: 'kg' | 'lb'
  note: string
}

type CardioInput = {
  type: 'cardio'
  name: string
  duration: number
  distance?: number
  distanceUnit?: 'km' | 'mi'
  note: string
}

type ExerciseInput = StrengthInput | CardioInput

export interface TrainingDraft {
  date: string
  feeling: FeelingType
  exercises: ExerciseInput[]
}

export interface ParseResult {
  rawText: string
  draft: TrainingDraft
  warnings: string[]
}

export interface MultiParseResult {
  rawText: string
  drafts: TrainingDraft[]
  warnings: string[]
}

// ─── AI Parser ────────────────────────────────────────────────────────────────

async function callAiParser(
  text: string,
  exerciseNames: string[],
): Promise<{ draft: TrainingDraft; warnings: string[] } | null> {
  const today = localDateStr()

  const systemPrompt = `你是一个健身训练记录解析助手。用户会输入一段自然语言训练记录，你必须将其解析为严格的 JSON 结构。

已知动作名称（优先使用这些名称，不要改变大小写）：
${exerciseNames.join('、')}

今天日期：${today}

输出要求（只输出合法 JSON，不要输出任何解释文字）：
{
  "draft": {
    "date": "YYYY-MM-DD",
    "feeling": "great|good|ok|tired|bad",
    "exercises": [
      {
        "type": "strength",
        "name": "动作名",
        "sets": 3,
        "reps": 10,
        "weight": 60,
        "unit": "kg",
        "note": ""
      },
      {
        "type": "cardio",
        "name": "动作名",
        "duration": 30,
        "note": ""
      }
    ]
  },
  "warnings": []
}

解析规则：
- date 默认今天 ${today}，若用户提到"昨天"则减一天
- feeling：很棒/状态好/超好 → great；不错/还行/挺好 → good；一般/普通 → ok；有点累/比较累/很累/疲惫 → tired；难受/不舒服/很差 → bad；无情绪词 → ok；同时有多个情绪词时取更强烈的那个
- 力量动作：sets/reps/weight 均为数字；若用户未明确说明 sets 或 reps，设为 0（不要猜测），并在 warnings 中注明"XXX 的次数/组数未明确，请补充"；weight 未提及时设为 0（合法，不需要 warning）；unit 默认 "kg"，"斤"=0.5kg，磅/lb 保留 lb 单位
- 有氧动作：duration 为分钟数；"半小时"=30，"一小时"=60；若用户未明确说明时长，设为 0 并在 warnings 中注明；distance/distanceUnit 可选，若无则不包含这两个字段
- 0 是合法的占位值，代表用户需要补充，不代表错误，前端会提示用户填写
- 动作名优先匹配已知列表（忽略大小写），未匹配时保留用户原文
- 如果用户说某个之前提到的数据有误、以当前记录为准，完全忽略被否定的数据，不要包含进 exercises
- 如果同一动作分热身组和正式组，拆分为两个同名条目，note 分别填写"热身"和"正式组"
- 如果同一动作有多个不同重量/组次描述（如"前三组 80kg，后两组 60kg"），同样拆分为多个条目
- note 字段仅用于标注"热身"/"正式组"等分组信息，其余情况保持空字符串`

  const parsed = await chatJson<{ draft: TrainingDraft; warnings: string[] }>(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text },
    ],
    { timeoutMs: 15000, temperature: 0 },
  )

  if (
    !parsed?.draft?.date ||
    !parsed?.draft?.feeling ||
    !Array.isArray(parsed?.draft?.exercises) ||
    parsed.draft.exercises.length === 0
  ) {
    if (parsed) console.warn('[AI Parser] Invalid structure, falling back to rule parser')
    return null
  }

  console.log(`[AI Parser] parsed ${parsed.draft.exercises.length} exercises`)
  return { draft: parsed.draft, warnings: parsed.warnings ?? [] }
}

async function callAiMultiParser(
  text: string,
  exerciseNames: string[],
): Promise<{ drafts: TrainingDraft[]; warnings: string[] } | null> {
  const today = localDateStr()
  const yesterday = localDateStr(-1)

  const systemPrompt = `你是一个健身训练记录解析助手。用户可能在同一条消息里同时描述多天训练，你必须按日期拆分为多个训练草稿，输出严格 JSON。

已知动作名称（优先使用这些名称，不要改变大小写）：
${exerciseNames.join('、')}

今天日期：${today}
昨天日期：${yesterday}

输出要求（只输出合法 JSON，不要输出任何解释文字）：
{
  "drafts": [
    {
      "date": "YYYY-MM-DD",
      "feeling": "great|good|ok|tired|bad",
      "exercises": [
        {
          "type": "strength",
          "name": "动作名",
          "sets": 3,
          "reps": 10,
          "weight": 60,
          "unit": "kg",
          "note": ""
        },
        {
          "type": "cardio",
          "name": "动作名",
          "duration": 30,
          "note": ""
        }
      ]
    }
  ],
  "warnings": []
}

解析规则：
- 如果用户同时提到"今天"和"昨天"，必须拆成两个 draft，不能合并到同一天。
- "今天"=${today}，"昨天"=${yesterday}。明确日期按用户日期解析。
- 某段没有日期时，继承前文最近一次出现的日期；没有任何日期时默认今天。
- 同一天多个动作放在同一个 draft；不同日期必须放不同 draft。
- feeling 规则：很棒/状态好/超好 → great；不错/还行/挺好 → good；一般/普通/无情绪词 → ok；有点累/比较累/很累 → tired；难受/不舒服/很差 → bad。
- 力量动作：sets/reps/weight 均为数字；若未明确 sets 或 reps，设为 0 并在 warnings 中注明；weight 未提及时设为 0；unit 默认 "kg"，"斤"=0.5kg。
- 有氧动作：duration 为分钟；"半小时"=30，"一小时"=60；未明确时长设为 0 并 warning；distance 可选。
- 动作名优先匹配已知列表，未匹配时保留用户原文。
- 热身/正式组或不同重量组次应拆成多个同名 exercise，用 note 标注"热身"或"正式组"。`

  const parsed = await chatJson<{ drafts: TrainingDraft[]; warnings: string[] }>(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text },
    ],
    { timeoutMs: 15000, temperature: 0 },
  )

  if (!Array.isArray(parsed?.drafts) || parsed.drafts.length === 0) {
    if (parsed) console.warn('[AI Multi Parser] Invalid structure, falling back')
    return null
  }

  const drafts = parsed.drafts.filter(d =>
    d?.date &&
    d?.feeling &&
    Array.isArray(d.exercises) &&
    d.exercises.length > 0,
  )

  if (drafts.length === 0) return null
  console.log(`[AI Multi Parser] parsed ${drafts.length} draft(s)`)
  return { drafts, warnings: parsed.warnings ?? [] }
}

// ─── 规则 Parser ───────────────────────────────────────────────────────────────

// 优先检测强情绪词（bad/tired/great），再匹配弱情绪词（ok 最后兜底）
const FEELING_PATTERNS: Array<[RegExp, FeelingType]> = [
  [/难受|不舒服|很差|很糟/, 'bad'],
  [/有点累|有些累|比较累|很累|疲惫|累死/, 'tired'],
  [/很棒|状态很好|超好|太棒了|太爽/, 'great'],
  [/不错|还行|挺好|还可以/, 'good'],
  [/一般|普通|凑合|还好/, 'ok'],
]

function detectFeeling(text: string): FeelingType {
  for (const [pattern, feeling] of FEELING_PATTERNS) {
    if (pattern.test(text)) return feeling
  }
  return 'ok'
}

function parseSegment(seg: string, cardioExerciseNames: Set<string>): ExerciseInput | string {
  const s = seg.trim()
  if (!s || !/\d/.test(s)) return `"${s}" 无数字信息，已跳过`

  // NxM + weight：深蹲 4x8 80kg / 深蹲 4×8 80kg
  const nxmWeight = s.match(/^([\u4e00-\u9fa5a-zA-Z]+)\s+(\d+)[xX×](\d+)\s*([\d.]+)\s*(公斤|kg|千克|lb|磅)?/)
  if (nxmWeight) {
    const [, name, sets, reps, weight, unitRaw = 'kg'] = nxmWeight
    const unit = unitRaw === 'lb' || unitRaw === '磅' ? 'lb' : 'kg'
    return { type: 'strength', name: name.trim(), sets: parseInt(sets), reps: parseInt(reps), weight: parseFloat(weight), unit, note: '' }
  }

  // NxM 无重量：引体向上 3x8
  const nxmOnly = s.match(/^([\u4e00-\u9fa5a-zA-Z]+)\s+(\d+)[xX×](\d+)\s*$/)
  if (nxmOnly) {
    const [, name, sets, reps] = nxmOnly
    return { type: 'strength', name: name.trim(), sets: parseInt(sets), reps: parseInt(reps), weight: 0, unit: 'kg', note: '' }
  }

  // 有氧 + 距离 + 时长：跑步 5公里 30分钟
  const cardioBoth = s.match(/^([\u4e00-\u9fa5a-zA-Z]+)\s+([\d.]+)\s*(公里|km|千米|mi|英里)\s*([\d.]+)\s*(分钟|分|min)/)
  if (cardioBoth) {
    const [, name, dist, distUnit, dur] = cardioBoth
    const distanceUnit = distUnit === 'mi' || distUnit === '英里' ? 'mi' : 'km'
    return { type: 'cardio', name: name.trim(), duration: parseFloat(dur), distance: parseFloat(dist), distanceUnit, note: '' }
  }

  // 有氧 + 时长：跑步 30分钟
  const cardioTime = s.match(/^([\u4e00-\u9fa5a-zA-Z]+)\s*([\d.]+)\s*(分钟|分|min)/)
  if (cardioTime) {
    const [, name, dur] = cardioTime
    const exerciseName = name.trim()
    if (cardioExerciseNames.has(exerciseName) || /球$|篮球|打球/.test(exerciseName)) {
      return { type: 'cardio', name: exerciseName, duration: parseFloat(dur), note: '' }
    }
  }

  // 力量：灵活 token 匹配（任意顺序）
  const nameMatch = s.match(/^([\u4e00-\u9fa5a-zA-Z]+)/)
  if (!nameMatch) return `"${s}" 无法识别动作名`
  const name = nameMatch[1].trim()
  const rest = s.slice(name.length)

  const setsMatch = rest.match(/(\d+)\s*(组|set)/)
  const repsMatch = rest.match(/(\d+)\s*(次|rep)/)
  const weightMatch = rest.match(/([\d.]+)\s*(公斤|kg|千克|lb|磅)/)

  if (setsMatch && repsMatch) {
    const unit = weightMatch && (weightMatch[2] === 'lb' || weightMatch[2] === '磅') ? 'lb' : 'kg'
    return {
      type: 'strength',
      name,
      sets: parseInt(setsMatch[1]),
      reps: parseInt(repsMatch[1]),
      weight: weightMatch ? parseFloat(weightMatch[1]) : 0,
      unit,
      note: '',
    }
  }

  return `"${s}" 无法解析组数或次数，已跳过`
}

function parseWithRules(text: string, cardioExerciseNames: Set<string>): { draft: TrainingDraft; warnings: string[] } {
  const today = localDateStr()
  const feeling = detectFeeling(text)
  const warnings: string[] = []
  const exercises: ExerciseInput[] = []

  const segments = text.split(/[，,、；;\n。]+/).map(s => s.trim()).filter(Boolean)

  for (const seg of segments) {
    const result = parseSegment(seg, cardioExerciseNames)
    if (typeof result === 'string') {
      if (result.includes('跳过')) warnings.push(result)
    } else {
      exercises.push(result)
    }
  }

  if (exercises.length === 0) {
    warnings.push('未能从文字中识别出训练动作，请展开详细编辑手动填写')
  }

  return { draft: { date: today, feeling, exercises }, warnings }
}

function parseManyWithRules(text: string, cardioExerciseNames: Set<string>): { drafts: TrainingDraft[]; warnings: string[] } {
  const normalized = text.replace(/\r/g, '\n')
  const parts = normalized
    .split(/(?=(?:今天|今日|昨天|昨日|前天|\d{1,2}[./月]\d{1,2}日?))/)
    .map(s => s.trim())
    .filter(Boolean)

  if (parts.length <= 1 && !/^(今天|今日|昨天|昨日|前天|\d{1,2}[./月]\d{1,2}日?)/.test(normalized.trim())) {
    const single = parseWithRules(text, cardioExerciseNames)
    return { drafts: [single.draft], warnings: single.warnings }
  }

  const drafts: TrainingDraft[] = []
  const warnings: string[] = []
  let currentDate = localDateStr()

  for (const part of parts) {
    if (/前天/.test(part)) currentDate = localDateStr(-2)
    else if (/昨天|昨日/.test(part)) currentDate = localDateStr(-1)
    else if (/今天|今日/.test(part)) currentDate = localDateStr()
    else {
      const md = part.match(/^(\d{1,2})[./月](\d{1,2})日?/)
      if (md) currentDate = `${localDateStr().slice(0, 4)}-${md[1].padStart(2, '0')}-${md[2].padStart(2, '0')}`
    }

    const cleaned = part
      .replace(/^(今天|今日|昨天|昨日|前天)[，,、：:\s]*/, '')
      .replace(/^\d{1,2}[./月]\d{1,2}日?[，,、：:\s]*/, '')
    const parsed = parseWithRules(cleaned, cardioExerciseNames)
    if (parsed.draft.exercises.length > 0) {
      drafts.push({ ...parsed.draft, date: currentDate })
    }
    warnings.push(...parsed.warnings)
  }

  if (drafts.length === 0) {
    const single = parseWithRules(text, cardioExerciseNames)
    return { drafts: [single.draft], warnings: single.warnings }
  }

  return { drafts, warnings }
}

// ─── 主入口 ───────────────────────────────────────────────────────────────────

export async function parseTrainingText(text: string): Promise<ParseResult> {
  const store = getMuscleMapStore()

  const allExerciseNames = store.items
    .filter(e => e.enabled)
    .flatMap(e => [e.exerciseName, ...e.aliases])

  const cardioExerciseNames = new Set(
    store.items
      .filter(e => e.enabled && e.type === 'cardio')
      .flatMap(e => [e.exerciseName, ...e.aliases]),
  )

  const aiResult = await callAiParser(text, allExerciseNames)
  if (aiResult) {
    return { rawText: text, ...aiResult }
  }

  const ruleResult = parseWithRules(text, cardioExerciseNames)
  return { rawText: text, ...ruleResult }
}

export async function parseTrainingTextMany(text: string): Promise<MultiParseResult> {
  const store = getMuscleMapStore()

  const allExerciseNames = store.items
    .filter(e => e.enabled)
    .flatMap(e => [e.exerciseName, ...e.aliases])

  const cardioExerciseNames = new Set(
    store.items
      .filter(e => e.enabled && e.type === 'cardio')
      .flatMap(e => [e.exerciseName, ...e.aliases]),
  )

  const aiResult = await callAiMultiParser(text, allExerciseNames)
  if (aiResult) {
    return { rawText: text, ...aiResult }
  }

  const ruleResult = parseManyWithRules(text, cardioExerciseNames)
  return { rawText: text, ...ruleResult }
}
