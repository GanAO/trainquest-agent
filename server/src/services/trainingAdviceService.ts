import { chatJson, chatText } from './aiClientService'
import { sortedWorkouts, localToday } from './feishuQueryService'
import { buildAthleteProfileSummary, getAthleteProfile } from './athleteProfileService'
import { fmtAdviceStructured } from './feishuFormatter'
import type { LastAdviceContext } from './feishuSessionService'
import type { WorkoutRecord, StrengthExercise } from '../domain/types'

// ─── 历史摘要构建（可供网页端复用）──────────────────────────────────────────────

function fmtExerciseForSummary(ex: WorkoutRecord['exercises'][number]): string {
  if (ex.type === 'strength') {
    const s = ex as StrengthExercise
    const weight = s.weight > 0 ? `  ${s.weight}${s.unit}` : ''
    return `${s.name}  ${s.sets}组×${s.reps}次${weight}`
  }
  const dist = ex.distance != null ? `  ${ex.distance}${ex.distanceUnit ?? 'km'}` : ''
  return `${ex.name}  ${ex.duration}分钟${dist}`
}

export function buildTrainingHistorySummary(days = 14): string {
  const today = localToday()
  const cutoff = new Date(today)
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const workouts = sortedWorkouts().filter(w => w.date >= cutoffStr)

  if (workouts.length === 0) {
    return `最近 ${days} 天暂无训练记录`
  }

  const lines = [`最近 ${days} 天训练记录（共 ${workouts.length} 次）：`]
  workouts.forEach(w => {
    lines.push('', w.date)
    w.exercises.forEach(ex => lines.push(`  ${fmtExerciseForSummary(ex)}`))
  })
  lines.push('', `今天：${today}`)
  return lines.join('\n')
}

export function buildExerciseHistorySummary(exerciseName: string, limit = 5): string {
  const name = exerciseName.trim().toLowerCase()
  const workoutsWithExercise = sortedWorkouts()
    .filter(w => w.exercises.some(ex => ex.name.toLowerCase().includes(name)))
    .slice(0, limit)

  if (workoutsWithExercise.length === 0) {
    return `暂无「${exerciseName}」的训练记录`
  }

  const lines = [`「${exerciseName}」近 ${workoutsWithExercise.length} 次记录：`]
  workoutsWithExercise.forEach(w => {
    const matches = w.exercises.filter(ex => ex.name.toLowerCase().includes(name))
    lines.push('', w.date)
    matches.forEach(ex => lines.push(`  ${fmtExerciseForSummary(ex)}`))
  })
  return lines.join('\n')
}

// ─── 训练建议主入口 ───────────────────────────────────────────────────────────

const EXERCISE_HINTS = ['卧推', '深蹲', '硬拉', '引体', '实力推', '推举', '跑步', '跳绳']

function detectExerciseInQuestion(question: string): string | null {
  const q = question.trim()
  for (const name of EXERCISE_HINTS) {
    if (q.includes(name)) return name
  }
  return null
}

function resolveExerciseName(
  userText: string,
  lastAdvice?: LastAdviceContext,
  sessionExercise?: string,
): string | null {
  return detectExerciseInQuestion(userText)
    ?? lastAdvice?.exerciseName
    ?? sessionExercise
    ?? null
}

function buildSystemPrompt(options: { followup?: boolean } = {}): string {
  const lengthHint = options.followup
    ? '回复 150–250 字，可以分段'
    : '回复简短，100 字以内'

  const base = `你是一个温和、专业的健身训练顾问，根据用户的真实训练历史和个人体能表给出个性化建议。

原则：
- 语气轻松，不说"必须"，用"可以考虑"、"如果状态不错"、"建议"等表达
- 明确引用历史数据作为建议依据
- 进步建议要保守：力量每次增加 2.5–5%，不要建议大幅跳跃
- 体能表中的目标仅作方向参考，建议重量必须优先依据最近 3 次实际训练记录
- 不做医疗/伤病诊断，不处理疼痛类问题
- 如果历史数据不足（少于 3 次），诚实说明并给保守建议
- ${lengthHint}
- 输出严格 JSON：{ "basis": "依据，引用具体数据", "advice": "主要建议", "optional": "可选调整，可为空字符串" }`

  const profile = getAthleteProfile()
  if (profile.preferences.antiAnxietyPrinciple) {
    return `${base}
- 禁止惩罚式连续打卡、禁止「落后」「必须赶上」类施压措辞`
  }
  return base
}

function buildAdviceUserContent(
  userQuestion: string,
  exerciseName: string | null,
  extra?: { lastAdvice?: LastAdviceContext; sessionSummary?: string },
): string {
  const profileSummary = buildAthleteProfileSummary()
  const historySummary = buildTrainingHistorySummary(14)
  const exerciseSummary = exerciseName
    ? buildExerciseHistorySummary(exerciseName)
    : ''

  const parts = [
    '## 个人体能表',
    profileSummary,
    '',
    '## 最近训练（14天）',
    historySummary,
  ]
  if (exerciseSummary) {
    parts.push('', '## 动作历史', exerciseSummary)
  }
  if (extra?.lastAdvice) {
    parts.push(
      '',
      '## 上一轮建议',
      `用户问：${extra.lastAdvice.userQuestion}`,
      `助手答：${extra.lastAdvice.answerSummary}`,
    )
  }
  if (extra?.sessionSummary) {
    parts.push('', '## 会话摘要', extra.sessionSummary)
  }
  parts.push('', '## 用户问题', userQuestion)
  return parts.join('\n')
}

async function callAdviceJson(
  userContent: string,
  followup = false,
): Promise<string> {
  const result = await chatJson<{ basis: string; advice: string; optional?: string }>(
    [
      { role: 'system', content: buildSystemPrompt({ followup }) },
      { role: 'user', content: userContent },
    ],
    { timeoutMs: 15000, temperature: 0.7 },
  )

  if (!result?.basis || !result?.advice) {
    const fallback = await chatText(
      [
        { role: 'system', content: buildSystemPrompt({ followup }).replace(/输出严格 JSON.*$/, '') },
        { role: 'user', content: userContent },
      ],
      { timeoutMs: 15000, temperature: 0.7 },
    )
    return fallback ?? '暂时无法获取建议，请稍后再试'
  }

  return fmtAdviceStructured(result.basis, result.advice, result.optional)
}

export async function getTrainingAdvice(userQuestion: string): Promise<string> {
  const exerciseName = detectExerciseInQuestion(userQuestion)
  const userContent = buildAdviceUserContent(userQuestion, exerciseName)
  return callAdviceJson(userContent, false)
}

export async function getFollowupTrainingAdvice(
  userText: string,
  lastAdviceContext: LastAdviceContext,
  sessionSummary?: string,
  sessionExercise?: string,
): Promise<string> {
  const exerciseName = resolveExerciseName(userText, lastAdviceContext, sessionExercise)
  const userContent = buildAdviceUserContent(userText, exerciseName, {
    lastAdvice: lastAdviceContext,
    sessionSummary,
  })
  return callAdviceJson(userContent, true)
}

/** 从建议回复中提取摘要，供 session 存储 */
export function summarizeAdviceReply(reply: string): string {
  const lines = reply.split('\n').filter(l => l.trim() && !l.startsWith('【'))
  return lines.join(' ').slice(0, 200)
}
