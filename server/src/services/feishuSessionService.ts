export type ActiveTopic = 'recording' | 'advice' | 'query' | 'profile' | 'idle'

export interface LastAdviceContext {
  userQuestion: string
  answerSummary: string
  exerciseName?: string
}

export interface FeishuSession {
  lastUserText?: string
  lastBotReplySummary?: string
  lastIntent?: string
  activeTopic: ActiveTopic
  activeExerciseName?: string
  lastAdviceContext?: LastAdviceContext
  updatedAt: number
  expiresAt: number
}

const SESSION_TTL_MS = 20 * 60 * 1000
const sessions = new Map<string, FeishuSession>()

function sessionKey(chatId: string, senderId: string): string {
  return `${chatId}:${senderId}`
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max) + '…'
}

export function getSession(chatId: string, senderId: string): FeishuSession | null {
  const entry = sessions.get(sessionKey(chatId, senderId))
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    sessions.delete(sessionKey(chatId, senderId))
    return null
  }
  return entry
}

export function updateSession(
  chatId: string,
  senderId: string,
  patch: Partial<Omit<FeishuSession, 'updatedAt' | 'expiresAt'>>,
): FeishuSession {
  const key = sessionKey(chatId, senderId)
  const existing = getSession(chatId, senderId)
  const now = Date.now()
  const next: FeishuSession = {
    activeTopic: 'idle',
    ...existing,
    ...patch,
    updatedAt: now,
    expiresAt: now + SESSION_TTL_MS,
  }
  sessions.set(key, next)
  return next
}

export function clearSession(chatId: string, senderId: string): void {
  sessions.delete(sessionKey(chatId, senderId))
}

export function buildSessionSummary(session: FeishuSession | null): string {
  if (!session) return '无历史会话'
  const lines = [`activeTopic: ${session.activeTopic}`]
  if (session.lastUserText) lines.push(`上一轮用户: ${truncate(session.lastUserText, 120)}`)
  if (session.lastBotReplySummary) lines.push(`上一轮Bot: ${truncate(session.lastBotReplySummary, 200)}`)
  if (session.activeExerciseName) lines.push(`当前动作: ${session.activeExerciseName}`)
  if (session.lastAdviceContext) {
    lines.push(`上轮建议问题: ${truncate(session.lastAdviceContext.userQuestion, 80)}`)
    lines.push(`上轮建议摘要: ${truncate(session.lastAdviceContext.answerSummary, 150)}`)
  }
  return lines.join('\n')
}

export interface SessionUpdateInput {
  userText: string
  intent: string
  botReply: string
  activeTopic?: ActiveTopic
  activeExerciseName?: string
  lastAdviceContext?: LastAdviceContext
}

export function recordSessionFromTurn(
  chatId: string,
  senderId: string,
  input: SessionUpdateInput,
): void {
  updateSession(chatId, senderId, {
    lastUserText: input.userText,
    lastBotReplySummary: truncate(input.botReply, 300),
    lastIntent: input.intent,
    activeTopic: input.activeTopic ?? topicFromIntent(input.intent),
    activeExerciseName: input.activeExerciseName,
    lastAdviceContext: input.lastAdviceContext,
  })
}

function topicFromIntent(intent: string): ActiveTopic {
  if (intent === 'record_workout' || intent === 'confirm_pending' || intent === 'cancel_pending') {
    return 'recording'
  }
  if (intent === 'training_advice' || intent === 'followup_advice') return 'advice'
  if (
    intent.startsWith('query_') &&
    intent !== 'query_capabilities' &&
    intent !== 'query_athlete_profile' &&
    intent !== 'query_goals' &&
    intent !== 'query_strength_levels'
  ) {
    return 'query'
  }
  if (
    intent === 'query_athlete_profile' ||
    intent === 'query_goals' ||
    intent === 'query_strength_levels' ||
    intent === 'update_athlete_field'
  ) {
    return 'profile'
  }
  return 'idle'
}
